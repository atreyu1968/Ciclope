import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  emailNotifications!: boolean;

  @IsBoolean()
  reminderEmails!: boolean;

  @IsBoolean()
  weeklySummaryEmail!: boolean;
}
