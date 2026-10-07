import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
export class RegistrarPushDto {
  @IsUUID('4') instalacionId: string;
  @IsString() @MaxLength(200) @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) token: string;
}
