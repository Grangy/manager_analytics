-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "client" TEXT,
    "status" TEXT,
    "manager" TEXT NOT NULL,
    "comment" TEXT,
    "businessRegion" TEXT,
    "link" TEXT,
    "siteOrderNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
