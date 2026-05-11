/**
 * Stress seed: provisions a household with a heavy task load to validate
 * UX scale targets (TTI < 1s with 100+ templates / 1000+ occurrences).
 *
 * Usage:  npm run db:seed:stress
 *
 * Creates demo-stress@quotidy.local / demo12345
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, startOfDay, subDays } from "date-fns";

const prisma = new PrismaClient();

const ROOMS = [
  "Cuisine",
  "Salle de bain",
  "Chambre",
  "Salon",
  "Bureau",
  "Entrée",
  "Buanderie",
  "Toilettes",
  "Couloir",
  "Garage",
];

const TASK_VERBS = [
  "Nettoyer",
  "Ranger",
  "Aspirer",
  "Désinfecter",
  "Trier",
  "Dépoussiérer",
  "Vider",
  "Plier",
  "Sortir",
  "Arroser",
];

const TASK_OBJECTS = [
  "le sol",
  "les surfaces",
  "le linge",
  "la vaisselle",
  "les déchets",
  "les fenêtres",
  "les miroirs",
  "les étagères",
  "les rideaux",
  "les plantes",
];

const COLORS = ["#E86A33", "#1F6E8C", "#5A8A6E", "#A45EA8", "#D4A745", "#3F86C7"];

async function main() {
  const email = "demo-stress@quotidy.local";

  // Wipe prior stress data idempotently
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const memberships = await prisma.householdMember.findMany({
      where: { userId: existing.id },
      select: { householdId: true },
    });
    const householdIds = [...new Set(memberships.map((m) => m.householdId))];
    if (householdIds.length) {
      await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    }
    await prisma.user.delete({ where: { id: existing.id } }).catch(() => undefined);
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName: "Charge",
      passwordHash: await bcrypt.hash("demo12345", 12),
    },
  });

  const household = await prisma.household.create({
    data: {
      name: "Foyer charge",
      timezone: "Europe/Paris",
      createdByUserId: user.id,
    },
  });

  const memberRecords = [
    { name: "Charge", color: COLORS[0], userId: user.id, role: "owner" as const },
    { name: "Bea", color: COLORS[1], role: "member" as const },
    { name: "Cam", color: COLORS[2], role: "member" as const },
    { name: "Dany", color: COLORS[3], role: "member" as const },
  ];

  const members: { id: string }[] = [];
  for (const m of memberRecords) {
    const created = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: m.userId,
        displayName: m.name,
        color: m.color,
        role: m.role,
      },
    });
    members.push({ id: created.id });
  }

  // 120 templates spread across rooms × verbs × objects
  const TEMPLATE_COUNT = 120;
  const today = startOfDay(new Date());
  const templates: { id: string; estimatedMinutes: number }[] = [];

  for (let i = 0; i < TEMPLATE_COUNT; i++) {
    const room = ROOMS[i % ROOMS.length];
    const verb = TASK_VERBS[i % TASK_VERBS.length];
    const obj = TASK_OBJECTS[(i + Math.floor(i / TASK_OBJECTS.length)) % TASK_OBJECTS.length];
    const intervalDays = [1, 2, 3, 7, 14, 30][i % 6];

    const recurrenceRule = await prisma.recurrenceRule.create({
      data: {
        type: "every_x_days",
        interval: intervalDays,
        anchorDate: subDays(today, i % 14),
        dueOffsetDays: 0,
      },
    });

    const assignmentRule = await prisma.assignmentRule.create({
      data: {
        mode: "strict_alternation",
        eligibleMemberIds: members.map((m) => m.id),
        rotationOrder: members.map((m) => m.id),
        fairnessWindowDays: 14,
      },
    });

    const estimatedMinutes = [10, 15, 20, 30, 45, 60][i % 6];

    const template = await prisma.taskTemplate.create({
      data: {
        householdId: household.id,
        title: `${verb} ${obj} — ${room} ${i + 1}`,
        room,
        category: "Nettoyage",
        estimatedMinutes,
        startsOn: subDays(today, 30),
        recurrenceRuleId: recurrenceRule.id,
        assignmentRuleId: assignmentRule.id,
        createdByMemberId: members[0].id,
        color: COLORS[i % COLORS.length],
      },
    });

    templates.push({ id: template.id, estimatedMinutes });
  }

  // ~1000 occurrences across past 30 days and next 30 days
  const occurrenceData: Prisma.TaskOccurrenceCreateManyInput[] = [];
  let occCount = 0;
  for (let dayOffset = -30; dayOffset <= 30 && occCount < 1100; dayOffset++) {
    const date = addDays(today, dayOffset);
    // ~17 occurrences per day → ~1000 total over 60 days
    for (let k = 0; k < 17 && occCount < 1100; k++) {
      const template = templates[(dayOffset + 30 + k) % templates.length];
      const member = members[(dayOffset + 30 + k) % members.length];
      const status =
        dayOffset < -1
          ? k % 5 === 0
            ? "skipped"
            : "completed"
          : dayOffset < 0
            ? "overdue"
            : dayOffset === 0
              ? "due"
              : "planned";

      occurrenceData.push({
        householdId: household.id,
        taskTemplateId: template.id,
        scheduledDate: date,
        dueDate: date,
        originalScheduledDate: date,
        sourceGenerationKey: `stress-${template.id}-${dayOffset}-${k}`,
        status: status as "planned" | "due" | "overdue" | "completed" | "skipped",
        assignedMemberId: member.id,
        ...(status === "completed"
          ? {
              completedByMemberId: member.id,
              completedAt: date,
              actualMinutes: template.estimatedMinutes + (k % 10) - 5,
            }
          : {}),
      });
      occCount++;
    }
  }

  // Bulk insert
  for (let i = 0; i < occurrenceData.length; i += 200) {
    await prisma.taskOccurrence.createMany({
      data: occurrenceData.slice(i, i + 200),
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      email,
      password: "demo12345",
      household: household.name,
      templateCount: templates.length,
      occurrenceCount: occurrenceData.length,
      memberCount: members.length,
    }),
  );
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
