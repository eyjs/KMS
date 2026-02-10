-- AlterTable: documents에 유효기간 필드 추가
ALTER TABLE "documents" ADD COLUMN "valid_until" TIMESTAMP(3);
