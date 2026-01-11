-- CreateTable
CREATE TABLE "sms_deliveries" (
    "id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "messageId" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerPayload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_deliveries_pkey" PRIMARY KEY ("id")
);
