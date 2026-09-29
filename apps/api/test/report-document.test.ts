import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { ReportDocumentService } from '../src/reports/report-document.service';

const report = {
  center: { name: 'IES Prueba CÍCLOPE' },
  academicYear: { name: '2026-2027' },
  network: null,
  period: {
    from: '2026-09-01T00:00:00.000Z',
    to: '2027-06-30T23:59:59.000Z',
  },
  totals: {
    validated: 12,
    participants: 240,
    totalHours: 18.5,
    evidence: 20,
    evidenceCoveragePercent: 92,
  },
  transversalOverview: {
    networkCount: 4,
    networksWithActivity: 4,
    plansConfigured: 4,
    averagePlanProgressPercent: 55,
    networksWithOverdueTasks: 1,
    rows: [
      { name: 'Innovación', actions: 4, participants: 80, evidence: 7, planProgressPercent: 60, tasksOverdue: 0 },
      { name: 'Emprendimiento', actions: 3, participants: 60, evidence: 5, planProgressPercent: 50, tasksOverdue: 1 },
    ],
  },
  alerts: [
    { title: 'Seguimiento documental', detail: 'Una actuación debe completar su evidencia.' },
  ],
  planProgress: [
    {
      network: { name: 'Innovación' },
      averageProgressPercent: 60,
      measurableObjectives: 2,
      taskSummary: { done: 3, pending: 1, overdue: 0 },
    },
  ],
  byNetwork: [
    { name: 'Innovación', actions: 4, participants: 80, evidence: 7 },
    { name: 'Calidad', actions: 3, participants: 60, evidence: 5 },
  ],
  byFamily: [
    { name: 'Administración y Gestión', actions: 7, participants: 140 },
  ],
};

const narrative = 'La coordinación valora positivamente la participación registrada.\n\nSe mantendrá el seguimiento de evidencias pendientes.';

test('genera un DOCX válido con la memoria y la narrativa revisada', async () => {
  const service = new ReportDocumentService();
  const buffer = await service.docx(report, narrative);

  assert.ok(buffer.byteLength > 1000);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('string');

  assert.match(documentXml, /CÍCLOPE FP/);
  assert.match(documentXml, /IES Prueba CÍCLOPE/);
  assert.match(documentXml, /Administración y Gestión/);
  assert.match(documentXml, /La coordinación valora positivamente/);
});

test('genera un ODT válido con mimetype, manifiesto y contenido de memoria', async () => {
  const service = new ReportDocumentService();
  const buffer = await service.odt(report, narrative);

  assert.ok(buffer.byteLength > 700);
  const zip = await JSZip.loadAsync(buffer);
  const mime = await zip.file('mimetype')!.async('string');
  const content = await zip.file('content.xml')!.async('string');
  const manifest = await zip.file('META-INF/manifest.xml')!.async('string');

  assert.equal(mime, 'application/vnd.oasis.opendocument.text');
  assert.match(manifest, /application\/vnd\.oasis\.opendocument\.text/);
  assert.match(content, /CÍCLOPE FP/);
  assert.match(content, /IES Prueba CÍCLOPE/);
  assert.match(content, /La coordinación valora positivamente/);
});
