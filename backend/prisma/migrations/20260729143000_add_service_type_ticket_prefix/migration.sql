ALTER TABLE "service_types"
ADD COLUMN "ticketPrefix" TEXT;

UPDATE "service_types"
SET "ticketPrefix" = CASE
  WHEN "name" = 'Консультация терапевта' THEN 'К'
  WHEN "name" = 'Регистратура' THEN 'Р'
  WHEN "name" = 'Оплата услуг' THEN 'П'
  WHEN "name" = 'Лабораторные анализы' THEN 'А'
  WHEN "name" = 'Рентген' THEN 'Х'
  WHEN "name" = 'УЗИ' THEN 'У'
  WHEN "name" = 'Вакцинация' THEN 'В'
  WHEN "name" = 'Справки и документы' THEN 'Д'
  ELSE 'S' || "id"::text
END
WHERE "ticketPrefix" IS NULL;

ALTER TABLE "service_types"
ALTER COLUMN "ticketPrefix" SET NOT NULL;

CREATE UNIQUE INDEX "service_types_ticketPrefix_key" ON "service_types"("ticketPrefix");
