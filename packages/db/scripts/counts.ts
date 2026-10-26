import { prisma } from "./src/index.js";

const notifications = await prisma.notification.count();
const outbox = await prisma.eventOutbox.groupBy({ by: ["status"], _count: true });
console.log(JSON.stringify({ notifications, outbox }, null, 2));
await prisma.$disconnect();
