export class UpdateRoomDto {
  name?: string;
  isActive?: boolean;
  active?: boolean;
  placeType?: string;
  workingStartTime?: string;   // формат "HH:MM", например "08:00"
  workingEndTime?: string;     // формат "HH:MM", например "18:00"
  serviceTypeIds?: number[];
  services?: number[];
}