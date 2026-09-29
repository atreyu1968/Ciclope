import test from 'node:test';
import assert from 'node:assert/strict';
import { MailOutboxService } from '../src/mail/mail-outbox.service';

type TestUser = {
  id: string;
  emailNotifications: boolean;
  reminderEmails: boolean;
  weeklySummaryEmail: boolean;
};

function createService(users: TestUser[]) {
  const created: any[] = [];
  const prisma = {
    user: {
      findMany: async ({ where }: any) => users
        .filter((user) => where.id.in.includes(user.id))
        .filter((user) => !where.emailNotifications || user.emailNotifications)
        .filter((user) => where.reminderEmails === undefined || user.reminderEmails === where.reminderEmails)
        .filter((user) => where.weeklySummaryEmail === undefined || user.weeklySummaryEmail === where.weeklySummaryEmail)
        .map((user) => ({ id: user.id })),
    },
    emailOutbox: {
      createMany: async ({ data }: any) => {
        created.push(...data);
        return { count: data.length };
      },
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
  };
  const integrations = {
    resendConfig: async () => ({ apiKey: 'test', fromEmail: 'ciclope@example.test', fromName: 'CÍCLOPE FP' }),
  };
  const service = new MailOutboxService(prisma as never, integrations as never);
  (service as any).processBatch = async () => undefined;
  return { service, created };
}

const recipients = [
  { id: 'all', email: 'all@example.test' },
  { id: 'no-general', email: 'nogeneral@example.test' },
  { id: 'no-reminders', email: 'noreminders@example.test' },
  { id: 'no-weekly', email: 'noweekly@example.test' },
];

const users: TestUser[] = [
  { id: 'all', emailNotifications: true, reminderEmails: true, weeklySummaryEmail: true },
  { id: 'no-general', emailNotifications: false, reminderEmails: true, weeklySummaryEmail: true },
  { id: 'no-reminders', emailNotifications: true, reminderEmails: false, weeklySummaryEmail: true },
  { id: 'no-weekly', emailNotifications: true, reminderEmails: true, weeklySummaryEmail: false },
];

test('correo general respeta la preferencia global pero no desactiva categorías no relacionadas', async () => {
  const { service, created } = createService(users);
  const result = await service.enqueueDirect(
    'center-1',
    'Asunto',
    'Mensaje',
    recipients,
    'general',
  );

  assert.equal(result.queued, 3);
  assert.deepEqual(
    new Set(created.map((item) => item.userId)),
    new Set(['all', 'no-reminders', 'no-weekly']),
  );
});

test('recordatorios exigen correo general y preferencia de recordatorios', async () => {
  const { service, created } = createService(users);
  const results = await Promise.all(recipients.map((recipient) =>
    service.enqueueDirectOnce(
      'center-1',
      'reminder:' + recipient.id,
      'Recordatorio',
      'Mensaje',
      recipient,
      'reminder',
    ),
  ));

  assert.equal(results.reduce((sum, result) => sum + result.queued, 0), 2);
  assert.deepEqual(
    new Set(created.map((item) => item.userId)),
    new Set(['all', 'no-weekly']),
  );
});

test('resumen semanal exige correo general y preferencia semanal', async () => {
  const { service, created } = createService(users);
  const results = await Promise.all(recipients.map((recipient) =>
    service.enqueueDirectOnce(
      'center-1',
      'weekly:' + recipient.id,
      'Resumen semanal',
      'Mensaje',
      recipient,
      'weekly',
    ),
  ));

  assert.equal(results.reduce((sum, result) => sum + result.queued, 0), 2);
  assert.deepEqual(
    new Set(created.map((item) => item.userId)),
    new Set(['all', 'no-reminders']),
  );
});
