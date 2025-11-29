import { db } from "./db";
import { 
  users, 
  clientOrganizations, 
  clientPocs, 
  projects, 
  experts, 
  vettingQuestions,
  projectExperts,
  callRecords,
  expertInvitationLinks
} from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already has data, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("Test1234!", 10);

  const insertedUsers = await db.insert(users).values([
    { email: "admin@miraeconnext.com", fullName: "Admin User", role: "admin", passwordHash },
    { email: "pm@miraeconnext.com", fullName: "Sarah Chen", role: "pm", passwordHash },
    { email: "ra@miraeconnext.com", fullName: "Michael Lee", role: "ra", passwordHash },
    { email: "finance@miraeconnext.com", fullName: "Emily Park", role: "finance", passwordHash },
  ]).returning();

  console.log(`Inserted ${insertedUsers.length} users`);

  const insertedOrgs = await db.insert(clientOrganizations).values([
    { 
      name: "McKinsey & Company", 
      industry: "Consulting",
      mainPmId: insertedUsers[1].id,
      totalCuUsed: "125.50"
    },
    { 
      name: "Boston Consulting Group", 
      industry: "Consulting",
      mainPmId: insertedUsers[1].id,
      totalCuUsed: "45.00"
    },
    { 
      name: "Goldman Sachs", 
      industry: "Finance",
      mainPmId: insertedUsers[1].id,
      totalCuUsed: "0.00"
    },
    { 
      name: "JPMorgan Chase", 
      industry: "Finance",
      mainPmId: insertedUsers[1].id,
      totalCuUsed: "200.00"
    },
  ]).returning();

  console.log(`Inserted ${insertedOrgs.length} client organizations`);

  const insertedPocs = await db.insert(clientPocs).values([
    { organizationId: insertedOrgs[0].id, name: "Jennifer Kim", email: "jennifer.kim@mckinsey.com", jobTitle: "Senior Partner", phone: "+1 212 555 0101" },
    { organizationId: insertedOrgs[0].id, name: "David Chen", email: "david.chen@mckinsey.com", jobTitle: "Associate Partner", phone: "+1 212 555 0102" },
    { organizationId: insertedOrgs[1].id, name: "Michael Brown", email: "michael.brown@bcg.com", jobTitle: "Managing Director", phone: "+1 617 555 0201" },
    { organizationId: insertedOrgs[2].id, name: "Sarah Williams", email: "sarah.williams@gs.com", jobTitle: "Vice President", phone: "+1 212 555 0301" },
    { organizationId: insertedOrgs[3].id, name: "Robert Johnson", email: "robert.johnson@jpmorgan.com", jobTitle: "Executive Director", phone: "+1 212 555 0401" },
  ]).returning();

  console.log(`Inserted ${insertedPocs.length} client POCs`);

  const insertedProjects = await db.insert(projects).values([
    {
      name: "Battery Technology Market Analysis",
      projectOverview: "Comprehensive analysis of EV battery technology landscape and competitive dynamics",
      clientOrganizationId: insertedOrgs[0].id,
      clientName: "McKinsey & Company",
      clientPocName: "Jennifer Kim",
      clientPocEmail: "jennifer.kim@mckinsey.com",
      description: "Need experts in lithium-ion battery manufacturing, solid-state battery development, and EV charging infrastructure",
      industry: "Energy",
      status: "sourcing",
      createdByPmId: insertedUsers[1].id,
      assignedRaId: insertedUsers[2].id,
      totalCuUsed: "45.00"
    },
    {
      name: "Healthcare AI Integration Study",
      projectOverview: "Assessment of AI/ML adoption in hospital systems and diagnostic tools",
      clientOrganizationId: insertedOrgs[0].id,
      clientName: "McKinsey & Company",
      clientPocName: "David Chen",
      clientPocEmail: "david.chen@mckinsey.com",
      description: "Seeking medical AI researchers, hospital CIOs, and health tech startup founders",
      industry: "Healthcare",
      status: "pending_client_review",
      createdByPmId: insertedUsers[1].id,
      assignedRaId: insertedUsers[2].id,
      totalCuUsed: "80.50"
    },
    {
      name: "Semiconductor Supply Chain Due Diligence",
      projectOverview: "Supply chain risk assessment for chip manufacturing investment",
      clientOrganizationId: insertedOrgs[2].id,
      clientName: "Goldman Sachs",
      clientPocName: "Sarah Williams",
      clientPocEmail: "sarah.williams@gs.com",
      description: "Need semiconductor engineers, supply chain executives, and geopolitical analysts",
      industry: "Technology",
      status: "new",
      createdByPmId: insertedUsers[1].id,
      totalCuUsed: "0.00"
    },
    {
      name: "Fintech Payment Systems Analysis",
      projectOverview: "Competitive landscape of digital payment platforms",
      clientOrganizationId: insertedOrgs[3].id,
      clientName: "JPMorgan Chase",
      clientPocName: "Robert Johnson",
      clientPocEmail: "robert.johnson@jpmorgan.com",
      description: "Looking for payment infrastructure experts, fintech executives, and regulatory specialists",
      industry: "Finance",
      status: "client_selected",
      createdByPmId: insertedUsers[1].id,
      assignedRaId: insertedUsers[2].id,
      totalCuUsed: "150.00"
    },
    {
      name: "Renewable Energy Investment Thesis",
      projectOverview: "Deep-dive into solar and wind energy market opportunities",
      clientOrganizationId: insertedOrgs[1].id,
      clientName: "Boston Consulting Group",
      clientPocName: "Michael Brown",
      clientPocEmail: "michael.brown@bcg.com",
      description: "Seeking renewable energy developers, utility executives, and clean tech investors",
      industry: "Energy",
      status: "completed",
      createdByPmId: insertedUsers[1].id,
      assignedRaId: insertedUsers[2].id,
      totalCuUsed: "45.00"
    },
  ]).returning();

  console.log(`Inserted ${insertedProjects.length} projects`);

  const insertedExperts = await db.insert(experts).values([
    {
      name: "Dr. James Chen",
      email: "james.chen@email.com",
      phone: "+1 415 555 1001",
      linkedinUrl: "https://linkedin.com/in/jameschen",
      country: "United States",
      timezone: "America/Los_Angeles",
      expertise: "Battery Technology",
      areasOfExpertise: ["Lithium-ion batteries", "Solid-state batteries", "Energy storage systems"],
      industry: "Energy",
      company: "Tesla",
      jobTitle: "Principal Battery Engineer",
      yearsOfExperience: 15,
      hourlyRate: "350.00",
      bio: "Former Tesla battery team lead with 15+ years in EV battery development",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Dr. Sarah Kim",
      email: "sarah.kim@email.com",
      phone: "+1 650 555 1002",
      linkedinUrl: "https://linkedin.com/in/sarahkim",
      country: "United States",
      timezone: "America/Los_Angeles",
      expertise: "Medical AI",
      areasOfExpertise: ["Diagnostic AI", "Medical imaging", "FDA regulatory"],
      industry: "Healthcare",
      company: "Google Health",
      jobTitle: "Senior Research Scientist",
      yearsOfExperience: 12,
      hourlyRate: "400.00",
      bio: "AI researcher specializing in medical diagnostics and FDA-cleared algorithms",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Michael Wong",
      email: "michael.wong@email.com",
      phone: "+1 408 555 1003",
      linkedinUrl: "https://linkedin.com/in/michaelwong",
      country: "United States",
      timezone: "America/Los_Angeles",
      expertise: "Semiconductor Manufacturing",
      areasOfExpertise: ["Chip fabrication", "Supply chain", "ASML equipment"],
      industry: "Technology",
      company: "Intel",
      jobTitle: "VP of Manufacturing",
      yearsOfExperience: 20,
      hourlyRate: "500.00",
      bio: "20-year semiconductor veteran with deep expertise in chip manufacturing",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Emily Zhang",
      email: "emily.zhang@email.com",
      phone: "+1 212 555 1004",
      linkedinUrl: "https://linkedin.com/in/emilyzhang",
      country: "United States",
      timezone: "America/New_York",
      expertise: "Digital Payments",
      areasOfExpertise: ["Payment infrastructure", "Fintech", "Regulatory compliance"],
      industry: "Finance",
      company: "Stripe",
      jobTitle: "Director of Product",
      yearsOfExperience: 10,
      hourlyRate: "375.00",
      bio: "Fintech executive with experience building payment systems at scale",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Dr. Robert Park",
      email: "robert.park@email.com",
      phone: "+1 713 555 1005",
      linkedinUrl: "https://linkedin.com/in/robertpark",
      country: "United States",
      timezone: "America/Chicago",
      expertise: "Renewable Energy",
      areasOfExpertise: ["Solar PV", "Wind energy", "Grid integration"],
      industry: "Energy",
      company: "NextEra Energy",
      jobTitle: "Chief Technology Officer",
      yearsOfExperience: 18,
      hourlyRate: "425.00",
      bio: "CTO at largest renewable energy company with deep technical expertise",
      status: "busy",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Lisa Johnson",
      email: "lisa.johnson@email.com",
      phone: "+1 617 555 1006",
      linkedinUrl: "https://linkedin.com/in/lisajohnson",
      country: "United States",
      timezone: "America/New_York",
      expertise: "Hospital Operations",
      areasOfExpertise: ["Healthcare IT", "EHR systems", "Digital transformation"],
      industry: "Healthcare",
      company: "Mass General Hospital",
      jobTitle: "Chief Information Officer",
      yearsOfExperience: 14,
      hourlyRate: "350.00",
      bio: "Hospital CIO with experience implementing AI solutions in clinical settings",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "David Lee",
      email: "david.lee@email.com",
      phone: "+886 2 555 1007",
      linkedinUrl: "https://linkedin.com/in/davidlee-tw",
      country: "Taiwan",
      timezone: "Asia/Taipei",
      expertise: "Chip Design",
      areasOfExpertise: ["ASIC design", "TSMC processes", "Advanced packaging"],
      industry: "Technology",
      company: "TSMC",
      jobTitle: "Senior Director",
      yearsOfExperience: 16,
      hourlyRate: "450.00",
      bio: "Senior TSMC executive with expertise in advanced node manufacturing",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
    {
      name: "Anna Martinez",
      email: "anna.martinez@email.com",
      phone: "+1 305 555 1008",
      linkedinUrl: "https://linkedin.com/in/annamartinez",
      country: "United States",
      timezone: "America/New_York",
      expertise: "Payment Regulations",
      areasOfExpertise: ["Banking regulations", "AML/KYC", "Cross-border payments"],
      industry: "Finance",
      company: "Federal Reserve",
      jobTitle: "Former Senior Policy Advisor",
      yearsOfExperience: 15,
      hourlyRate: "400.00",
      bio: "Former Fed policy advisor specializing in payment systems regulation",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true
    },
  ]).returning();

  console.log(`Inserted ${insertedExperts.length} experts`);

  const insertedVQ = await db.insert(vettingQuestions).values([
    { projectId: insertedProjects[0].id, question: "How many years of experience do you have with lithium-ion battery manufacturing?", isRequired: true, orderIndex: 1 },
    { projectId: insertedProjects[0].id, question: "Have you worked on solid-state battery development?", isRequired: true, orderIndex: 2 },
    { projectId: insertedProjects[0].id, question: "What is your familiarity with current EV charging infrastructure standards?", isRequired: false, orderIndex: 3 },
    { projectId: insertedProjects[1].id, question: "Have you developed or deployed FDA-cleared AI/ML diagnostic tools?", isRequired: true, orderIndex: 1 },
    { projectId: insertedProjects[1].id, question: "What hospital systems have you worked with to implement AI solutions?", isRequired: true, orderIndex: 2 },
    { projectId: insertedProjects[2].id, question: "What is your experience with semiconductor supply chain management?", isRequired: true, orderIndex: 1 },
    { projectId: insertedProjects[2].id, question: "Are you familiar with current US-China chip trade dynamics?", isRequired: true, orderIndex: 2 },
    { projectId: insertedProjects[3].id, question: "What payment rails have you built or worked with?", isRequired: true, orderIndex: 1 },
    { projectId: insertedProjects[3].id, question: "Do you have experience with cross-border payment regulations?", isRequired: false, orderIndex: 2 },
  ]).returning();

  console.log(`Inserted ${insertedVQ.length} vetting questions`);

  const insertedPE = await db.insert(projectExperts).values([
    { projectId: insertedProjects[0].id, expertId: insertedExperts[0].id, status: "accepted", notes: "Primary battery expert", availabilityNote: "Available next week" },
    { projectId: insertedProjects[0].id, expertId: insertedExperts[4].id, status: "invited", notes: "Backup energy expert" },
    { projectId: insertedProjects[1].id, expertId: insertedExperts[1].id, status: "client_selected", notes: "Top medical AI expert", vqAnswers: [{ questionId: 1, answer: "Yes, 3 FDA-cleared tools" }, { questionId: 2, answer: "Mass General, Cleveland Clinic" }] },
    { projectId: insertedProjects[1].id, expertId: insertedExperts[5].id, status: "accepted", notes: "Hospital CIO perspective", vqAnswers: [{ questionId: 1, answer: "Implemented Epic AI modules" }, { questionId: 2, answer: "Mass General Hospital" }] },
    { projectId: insertedProjects[2].id, expertId: insertedExperts[2].id, status: "assigned", notes: "Intel manufacturing expert" },
    { projectId: insertedProjects[2].id, expertId: insertedExperts[6].id, status: "assigned", notes: "TSMC perspective" },
    { projectId: insertedProjects[3].id, expertId: insertedExperts[3].id, status: "client_selected", notes: "Stripe payments expert", vqAnswers: [{ questionId: 1, answer: "ACH, Visa Direct, SWIFT" }, { questionId: 2, answer: "Yes, extensively" }] },
    { projectId: insertedProjects[3].id, expertId: insertedExperts[7].id, status: "client_selected", notes: "Regulatory expert", vqAnswers: [{ questionId: 1, answer: "FedNow, CHIPS, ACH" }, { questionId: 2, answer: "Yes, 15 years" }] },
    { projectId: insertedProjects[4].id, expertId: insertedExperts[4].id, status: "completed", notes: "Completed 3 calls" },
  ]).returning();

  console.log(`Inserted ${insertedPE.length} project-expert assignments`);

  const insertedCalls = await db.insert(callRecords).values([
    { 
      projectExpertId: insertedPE[0].id, 
      projectId: insertedProjects[0].id, 
      expertId: insertedExperts[0].id, 
      callDate: new Date("2024-12-02T14:00:00Z"), 
      durationMinutes: 60, 
      cuUsed: "2.00",
      status: "scheduled",
      zoomLink: "https://zoom.us/j/123456789"
    },
    { 
      projectExpertId: insertedPE[2].id, 
      projectId: insertedProjects[1].id, 
      expertId: insertedExperts[1].id, 
      callDate: new Date("2024-12-01T16:00:00Z"), 
      durationMinutes: 45, 
      cuUsed: "1.50",
      status: "completed",
      notes: "Excellent insights on FDA approval process"
    },
    { 
      projectExpertId: insertedPE[3].id, 
      projectId: insertedProjects[1].id, 
      expertId: insertedExperts[5].id, 
      callDate: new Date("2024-12-03T10:00:00Z"), 
      durationMinutes: 30, 
      cuUsed: "1.00",
      status: "scheduled",
      zoomLink: "https://teams.microsoft.com/l/meetup/abc123"
    },
    { 
      projectExpertId: insertedPE[6].id, 
      projectId: insertedProjects[3].id, 
      expertId: insertedExperts[3].id, 
      callDate: new Date("2024-11-28T15:00:00Z"), 
      durationMinutes: 90, 
      cuUsed: "3.00",
      status: "completed",
      notes: "Deep dive into payment infrastructure"
    },
    { 
      projectExpertId: insertedPE[7].id, 
      projectId: insertedProjects[3].id, 
      expertId: insertedExperts[7].id, 
      callDate: new Date("2024-11-29T11:00:00Z"), 
      durationMinutes: 60, 
      cuUsed: "2.00",
      status: "completed",
      notes: "Regulatory landscape overview"
    },
    { 
      projectExpertId: insertedPE[8].id, 
      projectId: insertedProjects[4].id, 
      expertId: insertedExperts[4].id, 
      callDate: new Date("2024-11-25T09:00:00Z"), 
      durationMinutes: 45, 
      cuUsed: "1.50",
      status: "completed",
      notes: "Final wrap-up call"
    },
  ]).returning();

  console.log(`Inserted ${insertedCalls.length} call records`);

  const insertedLinks = await db.insert(expertInvitationLinks).values([
    { token: "abc123-battery-expert", projectId: insertedProjects[0].id, recruitedBy: "ra@mirae.com", expiresAt: new Date("2025-01-01") },
    { token: "def456-healthcare-ai", projectId: insertedProjects[1].id, recruitedBy: "ra@mirae.com", expiresAt: new Date("2025-01-01") },
    { token: "ghi789-general", recruitedBy: "pm@mirae.com", expiresAt: new Date("2025-01-01") },
  ]).returning();

  console.log(`Inserted ${insertedLinks.length} invitation links`);

  const insertedMockProject = await db.insert(projects).values([
    {
      name: "Global Digital Payments Benchmarking Study",
      projectOverview: "Comparative benchmarking of digital wallets, BNPL, and merchant acquiring models across emerging markets (Brazil, India, Mexico, Indonesia)",
      clientOrganizationId: insertedOrgs[0].id,
      clientName: "Alpha Capital Partners",
      clientPocName: "Jennifer Kim",
      clientPocEmail: "jennifer.kim@mckinsey.com",
      description: "Comparative benchmarking of digital wallets, BNPL, and merchant acquiring models across emerging markets. Mock project for end-to-end workflow testing including expert invitation, email delivery, and availability check.",
      industry: "Finance",
      status: "sourcing",
      createdByPmId: insertedUsers[1].id,
      assignedRaId: insertedUsers[2].id,
      totalCuUsed: "0.00"
    }
  ]).returning();

  console.log(`Inserted ${insertedMockProject.length} mock projects`);

  const insertedMockExperts = await db.insert(experts).values([
    {
      name: "Mirae Kim",
      email: "kimmirae0305@gmail.com",
      phone: "+55 11 98765 4321",
      linkedinUrl: "https://linkedin.com/in/mirae-kim",
      country: "Brazil",
      timezone: "America/Sao_Paulo",
      expertise: "Digital Payments",
      areasOfExpertise: ["Market entry", "Expert networks", "Latin America", "B2B sales", "Consulting operations"],
      industry: "Fintech",
      company: "Global Digital Bank",
      jobTitle: "Growth and Strategy Consultant",
      yearsOfExperience: 9,
      hourlyRate: "250.00",
      bio: "Growth consultant with experience in expert networks and Latin American market entry. 9+ years in fintech and digital payments.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Guidepoint", jobTitle: "Research Manager", fromYear: 2021, toYear: 2025 },
        { company: "Benchlink", jobTitle: "Business Development Lead", fromYear: 2025, toYear: 2025 }
      ]
    },
    {
      name: "Carlos Eduardo Silva",
      email: "carlos.silva@example.com",
      phone: "+55 11 99876 5432",
      linkedinUrl: "https://linkedin.com/in/carloseduardo",
      country: "Brazil",
      timezone: "America/Sao_Paulo",
      expertise: "Digital Payments",
      areasOfExpertise: ["Digital wallets", "Credit card", "BNPL", "Growth strategy", "Unit economics"],
      industry: "Fintech",
      company: "Nubank",
      jobTitle: "Head of Digital Payments",
      yearsOfExperience: 14,
      hourlyRate: "300.00",
      bio: "Brazil based digital payments leader with experience launching wallets and BNPL products across Latin America.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Nubank", jobTitle: "Head of Digital Payments", fromYear: 2020, toYear: 2025 },
        { company: "Itau Unibanco", jobTitle: "Payments Product Manager", fromYear: 2014, toYear: 2020 }
      ]
    },
    {
      name: "Ana Luisa Rocha",
      email: "ana.rocha@example.com",
      phone: "+55 21 99876 5432",
      linkedinUrl: "https://linkedin.com/in/analuisa",
      country: "Brazil",
      timezone: "America/Sao_Paulo",
      expertise: "Payment Acquiring",
      areasOfExpertise: ["Merchant acquiring", "QR payments", "Partnerships", "SME onboarding", "KYC"],
      industry: "Fintech",
      company: "PicPay",
      jobTitle: "Senior Product Manager",
      yearsOfExperience: 11,
      hourlyRate: "280.00",
      bio: "Product leader focused on merchant acquiring and QR based payments in Brazil.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "PicPay", jobTitle: "Senior Product Manager", fromYear: 2021, toYear: 2025 },
        { company: "StoneCo", jobTitle: "Product Manager", fromYear: 2016, toYear: 2021 }
      ]
    },
    {
      name: "Rohit Verma",
      email: "rohit.verma@example.com",
      phone: "+91 80 9876 5432",
      linkedinUrl: "https://linkedin.com/in/rohitverma",
      country: "India",
      timezone: "Asia/Kolkata",
      expertise: "Digital Payments",
      areasOfExpertise: ["UPI", "Digital wallets", "Super app", "Product localization", "Partnerships"],
      industry: "Fintech",
      company: "Paytm",
      jobTitle: "VP Product, Consumer Payments",
      yearsOfExperience: 13,
      hourlyRate: "275.00",
      bio: "Leads consumer payments products including UPI and wallet solutions for a major Indian fintech.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Paytm", jobTitle: "VP Product, Consumer Payments", fromYear: 2019, toYear: 2025 },
        { company: "HDFC Bank", jobTitle: "Digital Banking Product Lead", fromYear: 2013, toYear: 2019 }
      ]
    },
    {
      name: "Priya Nair",
      email: "priya.nair@example.com",
      phone: "+91 22 9876 5432",
      linkedinUrl: "https://linkedin.com/in/priyanair",
      country: "India",
      timezone: "Asia/Kolkata",
      expertise: "Payment Networks",
      areasOfExpertise: ["Network partnerships", "Issuing", "Co branded cards", "Regulatory", "Risk"],
      industry: "Finance",
      company: "Global Card Network",
      jobTitle: "Director Partnerships, South Asia",
      yearsOfExperience: 15,
      hourlyRate: "320.00",
      bio: "Director responsible for payment network partnerships and co branded card launches across South Asia.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Global Card Network", jobTitle: "Director Partnerships, South Asia", fromYear: 2018, toYear: 2025 },
        { company: "Axis Bank", jobTitle: "Senior Manager, Cards", fromYear: 2010, toYear: 2018 }
      ]
    },
    {
      name: "Mariana Torres",
      email: "mariana.torres@example.com",
      phone: "+52 55 9876 5432",
      linkedinUrl: "https://linkedin.com/in/marianatorres",
      country: "Mexico",
      timezone: "America/Mexico_City",
      expertise: "Digital Payments",
      areasOfExpertise: ["Wallets", "BNPL", "Online checkout", "Risk models", "Growth marketing"],
      industry: "Fintech",
      company: "Mercado Pago",
      jobTitle: "Head of Product, Wallet and BNPL",
      yearsOfExperience: 12,
      hourlyRate: "290.00",
      bio: "Product lead for wallet and BNPL solutions across Mexico and LatAm markets.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Mercado Pago", jobTitle: "Head of Product, Wallet and BNPL", fromYear: 2020, toYear: 2025 },
        { company: "BBVA Mexico", jobTitle: "Digital Product Manager", fromYear: 2013, toYear: 2020 }
      ]
    },
    {
      name: "Diego Hernandez",
      email: "diego.hernandez@example.com",
      phone: "+52 81 9876 5432",
      linkedinUrl: "https://linkedin.com/in/diegohernandez",
      country: "Mexico",
      timezone: "America/Mexico_City",
      expertise: "Banking & Payments",
      areasOfExpertise: ["Agent network", "Cash in cash out", "Retail payments", "POS", "SME"],
      industry: "Finance",
      company: "Regional Bank",
      jobTitle: "Digital Banking Manager",
      yearsOfExperience: 8,
      hourlyRate: "200.00",
      bio: "Focus on digital banking for mass market and SME clients with experience in retail payment channels.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Regional Bank", jobTitle: "Digital Banking Manager", fromYear: 2020, toYear: 2025 },
        { company: "Oxxo Pay", jobTitle: "Product Specialist", fromYear: 2016, toYear: 2020 }
      ]
    },
    {
      name: "Siti Aisyah",
      email: "siti.aisyah@example.com",
      phone: "+62 21 9876 5432",
      linkedinUrl: "https://linkedin.com/in/sitiaisyah",
      country: "Indonesia",
      timezone: "Asia/Jakarta",
      expertise: "Super App Payments",
      areasOfExpertise: ["Super app payments", "Wallet integration", "QRIS", "Merchant ecosystem", "Product operations"],
      industry: "Fintech",
      company: "Gojek",
      jobTitle: "Senior Product Lead, Payments",
      yearsOfExperience: 10,
      hourlyRate: "260.00",
      bio: "Leads payments within a super app, with experience in merchant acceptance and QRIS rollout.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Gojek", jobTitle: "Senior Product Lead, Payments", fromYear: 2019, toYear: 2025 },
        { company: "Local Fintech Startup", jobTitle: "Product Manager", fromYear: 2015, toYear: 2019 }
      ]
    },
    {
      name: "Johannes Müller",
      email: "johannes.muller@example.com",
      phone: "+49 30 9876 5432",
      linkedinUrl: "https://linkedin.com/in/johannesmuller",
      country: "Germany",
      timezone: "Europe/Berlin",
      expertise: "Neobanking",
      areasOfExpertise: ["Europe", "PSD2", "Open banking", "Cards"],
      industry: "Fintech",
      company: "European Neo Bank",
      jobTitle: "Product Manager",
      yearsOfExperience: 6,
      hourlyRate: "240.00",
      bio: "European neobank product manager focused on open banking and PSD2 use cases.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "European Neo Bank", jobTitle: "Product Manager", fromYear: 2021, toYear: 2025 },
        { company: "Traditional Bank", jobTitle: "Business Analyst", fromYear: 2018, toYear: 2021 }
      ]
    },
    {
      name: "Laura Kim",
      email: "laura.kim@example.com",
      phone: "+1 415 555 9999",
      linkedinUrl: "https://linkedin.com/in/laurakim",
      country: "United States",
      timezone: "America/Los_Angeles",
      expertise: "Technology",
      areasOfExpertise: ["Cloud", "SaaS", "Data platforms"],
      industry: "Technology",
      company: "Big Tech",
      jobTitle: "Senior Program Manager",
      yearsOfExperience: 9,
      hourlyRate: "350.00",
      bio: "Works on cloud and SaaS programs with fintech interest.",
      status: "available",
      termsAccepted: true,
      lgpdAccepted: true,
      workHistory: [
        { company: "Big Tech", jobTitle: "Senior Program Manager", fromYear: 2019, toYear: 2025 },
        { company: "Startup", jobTitle: "Operations Manager", fromYear: 2014, toYear: 2019 }
      ]
    }
  ]).returning();

  console.log(`Inserted ${insertedMockExperts.length} mock experts`);

  const insertedMockVQ = await db.insert(vettingQuestions).values([
    { projectId: insertedMockProject[0].id, question: "What is your experience with digital wallet growth and user acquisition?", isRequired: true, orderIndex: 1 },
    { projectId: insertedMockProject[0].id, question: "What were the key drivers of BNPL adoption in your market?", isRequired: true, orderIndex: 2 },
    { projectId: insertedMockProject[0].id, question: "How are merchant fees structured in your region?", isRequired: false, orderIndex: 3 },
    { projectId: insertedMockProject[0].id, question: "What regulatory shifts have impacted payments in the last 3 years?", isRequired: false, orderIndex: 4 },
  ]).returning();

  console.log(`Inserted ${insertedMockVQ.length} mock vetting questions`);

  const mockMiraeExpertInProject = await db.insert(projectExperts).values([
    { projectId: insertedMockProject[0].id, expertId: insertedMockExperts[0].id, status: "invited", notes: "Mock expert for testing invitation workflow" }
  ]).returning();

  console.log(`Linked Mirae Kim to mock project`);

  console.log("Seeding completed successfully!");
}

seed().catch(console.error);
