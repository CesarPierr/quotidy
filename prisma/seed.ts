import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@quotidy.local";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName: "Alex",
      passwordHash: await bcrypt.hash("demo12345", 12),
    },
  });

  const household = await prisma.household.create({
    data: {
      name: "Maison Démo",
      timezone: "Europe/Paris",
      createdByUserId: user.id,
    },
  });

  const alex = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      userId: user.id,
      displayName: "Alex",
      color: "#E86A33",
      role: "owner",
    },
  });

  const sam = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      displayName: "Sam",
      color: "#1F6E8C",
      role: "member",
    },
  });

  const recurrenceRule = await prisma.recurrenceRule.create({
    data: {
      type: "every_x_weeks",
      interval: 2,
      anchorDate: new Date(),
      dueOffsetDays: 0,
    },
  });

  const assignmentRule = await prisma.assignmentRule.create({
    data: {
      mode: "strict_alternation",
      eligibleMemberIds: [alex.id, sam.id],
      rotationOrder: [alex.id, sam.id],
      fairnessWindowDays: 14,
    },
  });

  await prisma.taskTemplate.create({
    data: {
      householdId: household.id,
      title: "Nettoyer la salle de bain",
      category: "Nettoyage",
      estimatedMinutes: 35,
      startsOn: new Date(),
      recurrenceRuleId: recurrenceRule.id,
      assignmentRuleId: assignmentRule.id,
      createdByMemberId: alex.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
