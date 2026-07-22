import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { DEFAULT_PIPELINE_STAGES } from "../src/lib/pipeline-stages";
import { computeDedupeKey } from "../src/lib/dedupe";

const DEMO_TENANT_ID = "demo-tenant";
const DEMO_ADMIN_EMAIL = "admin@demo.test";
const DEMO_ADMIN_PASSWORD = "demo-password-123";

const CONTACTS = [
  {
    firstName: "Ava",
    lastName: "Reyes",
    email: "ava.reyes@brightpath.io",
    phone: "+1-555-0101",
    company: "Brightpath Media",
  },
  {
    firstName: "Liam",
    lastName: "Chen",
    email: "liam.chen@nova-logistics.com",
    phone: "+1-555-0102",
    company: "Nova Logistics",
  },
  {
    firstName: "Sophia",
    lastName: "Patel",
    email: "sophia@fernwood.co",
    phone: "+1-555-0103",
    company: "Fernwood Consulting",
  },
  {
    firstName: "Noah",
    lastName: "Williams",
    email: "noah.williams@summitgear.com",
    phone: "+1-555-0104",
    company: "Summit Gear Co.",
  },
  {
    firstName: "Emma",
    lastName: "Garcia",
    email: "emma@brightpath.io",
    phone: "+1-555-0105",
    company: "Brightpath Media",
  },
  {
    firstName: "Oliver",
    lastName: "Kim",
    email: "oliver.kim@lunahealth.com",
    phone: "+1-555-0106",
    company: "Luna Health",
  },
  {
    firstName: "Isabella",
    lastName: "Novak",
    email: "isabella@driftwood-studio.com",
    phone: "+1-555-0107",
    company: "Driftwood Studio",
  },
  {
    firstName: "Mason",
    lastName: "Brooks",
    email: "mason.brooks@ironcladworks.com",
    phone: "+1-555-0108",
    company: "Ironclad Works",
  },
  {
    firstName: "Mia",
    lastName: "Thompson",
    email: "mia@fernwood.co",
    phone: "+1-555-0109",
    company: "Fernwood Consulting",
  },
  {
    firstName: "Ethan",
    lastName: "Rossi",
    email: "ethan.rossi@summitgear.com",
    phone: "+1-555-0110",
    company: "Summit Gear Co.",
  },
  {
    firstName: "Charlotte",
    lastName: "Nguyen",
    email: "charlotte@lunahealth.com",
    phone: "+1-555-0111",
    company: "Luna Health",
  },
  {
    firstName: "James",
    lastName: "Foster",
    email: "james.foster@ironcladworks.com",
    phone: "+1-555-0112",
    company: "Ironclad Works",
  },
];

const LEAD_SOURCES = [
  "manual",
  "form:Website Contact Form",
  "form:Website Contact Form",
  "referral",
];

async function main() {
  const tenant = await db.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: {},
    create: { id: DEMO_TENANT_ID, name: "Demo Tenant", plan: "trial" },
  });

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const admin = await db.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      tenantId: tenant.id,
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
  });

  // The demo tenant is reseeded fresh every run (delete-then-recreate) rather
  // than upserted row-by-row — simplest way to keep a large, realistic,
  // interrelated dataset re-runnable without accumulating duplicates.
  await db.activity.deleteMany({ where: { tenantId: tenant.id } });
  await db.invoice.deleteMany({ where: { tenantId: tenant.id } });
  await db.callBooking.deleteMany({ where: { tenantId: tenant.id } });
  await db.formSubmission.deleteMany({ where: { tenantId: tenant.id } });
  await db.form.deleteMany({ where: { tenantId: tenant.id } });
  await db.opportunity.deleteMany({ where: { tenantId: tenant.id } });
  await db.lead.deleteMany({ where: { tenantId: tenant.id } });
  await db.contact.deleteMany({ where: { tenantId: tenant.id } });
  await db.webhookEndpoint.deleteMany({ where: { tenantId: tenant.id } });
  await db.pipelineStage.deleteMany({ where: { tenantId: tenant.id } });

  await db.pipelineStage.createMany({
    data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
      tenantId: tenant.id,
      ...stage,
    })),
  });

  const contacts = [];
  for (const c of CONTACTS) {
    const contact = await db.contact.create({
      data: { tenantId: tenant.id, ...c, dedupeKey: computeDedupeKey(c) },
    });
    contacts.push(contact);
  }

  // Leads: most contacts get a lead, at a mix of statuses/sources.
  const leadStatuses = ["new", "contacted", "qualified"];
  const leads = [];
  for (let i = 0; i < 9; i++) {
    const contact = contacts[i];
    const source = LEAD_SOURCES[i % LEAD_SOURCES.length];
    const status = leadStatuses[i % leadStatuses.length];
    const lead = await db.lead.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        source,
        status,
        score: 40 + i * 6,
      },
    });
    await db.activity.create({
      data: {
        tenantId: tenant.id,
        entityType: "lead",
        entityId: lead.id,
        type: "lead.created",
        payload: { source },
      },
    });
    if (status !== "new") {
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "lead",
          entityId: lead.id,
          type: "lead.status_changed",
          payload: { from: "new", to: status },
        },
      });
    }
    leads.push(lead);
  }

  // Opportunities: a spread across the pipeline, including two won and one lost.
  const opportunityPlan: {
    contactIndex: number;
    leadIndex: number | null;
    name: string;
    stage: string;
    value: number;
  }[] = [
    {
      contactIndex: 0,
      leadIndex: 0,
      name: "Brightpath — Annual Media Package",
      stage: "new",
      value: 8000,
    },
    {
      contactIndex: 1,
      leadIndex: 1,
      name: "Nova Logistics — Fleet Rollout",
      stage: "contacted",
      value: 15000,
    },
    {
      contactIndex: 2,
      leadIndex: 2,
      name: "Fernwood — Advisory Retainer",
      stage: "qualified",
      value: 12000,
    },
    {
      contactIndex: 3,
      leadIndex: 3,
      name: "Summit Gear — Wholesale Order",
      stage: "proposal",
      value: 22000,
    },
    {
      contactIndex: 6,
      leadIndex: null,
      name: "Driftwood Studio — Brand Refresh",
      stage: "proposal",
      value: 9500,
    },
    {
      contactIndex: 5,
      leadIndex: 5,
      name: "Luna Health — Platform License",
      stage: "closed_won",
      value: 30000,
    },
    {
      contactIndex: 7,
      leadIndex: 6,
      name: "Ironclad Works — Equipment Contract",
      stage: "closed_won",
      value: 18000,
    },
    {
      contactIndex: 4,
      leadIndex: 4,
      name: "Brightpath — Trial Extension",
      stage: "closed_lost",
      value: 4000,
    },
  ];

  for (const plan of opportunityPlan) {
    const contact = contacts[plan.contactIndex];
    const lead = plan.leadIndex !== null ? leads[plan.leadIndex] : null;
    const isClosed =
      plan.stage === "closed_won" || plan.stage === "closed_lost";
    const opportunity = await db.opportunity.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        leadId: lead?.id,
        name: plan.name,
        stage: plan.stage,
        value: plan.value,
        probability:
          plan.stage === "closed_won"
            ? 100
            : plan.stage === "closed_lost"
              ? 0
              : 50,
        closedAt: isClosed ? new Date() : undefined,
      },
    });
    await db.activity.create({
      data: {
        tenantId: tenant.id,
        entityType: "opportunity",
        entityId: opportunity.id,
        type: "opportunity.created",
        payload: { stage: "new" },
      },
    });
    if (plan.stage !== "new") {
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "opportunity",
          entityId: opportunity.id,
          type: "opportunity.stage_changed",
          payload: { from: "new", to: plan.stage },
        },
      });
    }

    if (plan.stage === "closed_won") {
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "opportunity",
          entityId: opportunity.id,
          type: "opportunity.closed_won",
          payload: {},
        },
      });
      const invoice = await db.invoice.create({
        data: {
          tenantId: tenant.id,
          opportunityId: opportunity.id,
          amount: plan.value,
        },
      });
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "opportunity",
          entityId: opportunity.id,
          type: "invoice.created",
          payload: {
            invoiceId: invoice.id,
            amount: invoice.amount.toString(),
            currency: invoice.currency,
          },
        },
      });
    } else if (plan.stage === "closed_lost") {
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "opportunity",
          entityId: opportunity.id,
          type: "opportunity.closed_lost",
          payload: {},
        },
      });
    }

    if (lead) {
      const callDate = new Date();
      callDate.setDate(callDate.getDate() + 2);
      const callEnd = new Date(callDate.getTime() + 30 * 60_000);
      const callBooking = await db.callBooking.create({
        data: {
          tenantId: tenant.id,
          leadId: lead.id,
          provider: "mock",
          externalEventId: `mock_${lead.id}`,
          startsAt: callDate,
          endsAt: callEnd,
          attendeeEmail: contact.email!,
        },
      });
      await db.activity.create({
        data: {
          tenantId: tenant.id,
          entityType: "lead",
          entityId: lead.id,
          type: "call.booked",
          payload: {
            callBookingId: callBooking.id,
            startsAt: callDate.toISOString(),
            attendeeEmail: contact.email,
          },
        },
      });
    }
  }

  // One form + a few submissions, so the Forms page has something to show.
  const form = await db.form.create({
    data: {
      tenantId: tenant.id,
      name: "Website Contact Form",
      embedKey: "demo-website-contact-form",
      fields: [
        { name: "firstName", label: "Name", required: true },
        { name: "email", label: "Email", required: true },
        { name: "company", label: "Company", required: false },
      ],
    },
  });
  for (let i = 0; i < 3; i++) {
    await db.formSubmission.create({
      data: {
        tenantId: tenant.id,
        formId: form.id,
        payload: {
          firstName: contacts[i].firstName,
          email: contacts[i].email,
          company: contacts[i].company,
        },
        status: "accepted",
        leadId: leads[i]?.id,
      },
    });
  }

  // An example (inactive) webhook endpoint, so the Webhooks page isn't empty
  // — inactive so it never actually fires against this placeholder URL.
  await db.webhookEndpoint.create({
    data: {
      tenantId: tenant.id,
      url: "https://example.com/webhook/demo-n8n-placeholder",
      secret: "demo-placeholder-secret-not-used",
      isActive: false,
    },
  });

  console.log(
    `Seeded tenant "${tenant.name}" (${tenant.id}) — admin ${admin.email} / ${contacts.length} contacts / ${leads.length} leads / ${opportunityPlan.length} opportunities.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
