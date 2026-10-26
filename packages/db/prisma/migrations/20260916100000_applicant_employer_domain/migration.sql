-- Applicant admissions + employer practicum domain

CREATE TABLE "AdmissionsApplication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "intakeTerm" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AdmissionsApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationOffer" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conditions" TEXT,
    "expiresOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ApplicationOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationTimelineEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployerOrg" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "EmployerOrg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "employerOrgId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsOn" TEXT,
    "endsOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HoursEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "HoursEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlacementEvaluation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'due',
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PlacementEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliationAgreement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "employerOrgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "renewsOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AffiliationAgreement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionsApplication_institutionId_accountId_idx" ON "AdmissionsApplication"("institutionId", "accountId");
CREATE INDEX "AdmissionsApplication_institutionId_status_idx" ON "AdmissionsApplication"("institutionId", "status");
CREATE INDEX "ApplicationDocument_institutionId_applicationId_idx" ON "ApplicationDocument"("institutionId", "applicationId");
CREATE INDEX "ApplicationOffer_institutionId_applicationId_idx" ON "ApplicationOffer"("institutionId", "applicationId");
CREATE INDEX "ApplicationTimelineEvent_institutionId_applicationId_idx" ON "ApplicationTimelineEvent"("institutionId", "applicationId");
CREATE INDEX "EmployerOrg_institutionId_idx" ON "EmployerOrg"("institutionId");
CREATE INDEX "EmployerOrg_institutionId_accountId_idx" ON "EmployerOrg"("institutionId", "accountId");
CREATE INDEX "Placement_institutionId_employerOrgId_idx" ON "Placement"("institutionId", "employerOrgId");
CREATE INDEX "HoursEntry_institutionId_placementId_idx" ON "HoursEntry"("institutionId", "placementId");
CREATE INDEX "PlacementEvaluation_institutionId_placementId_idx" ON "PlacementEvaluation"("institutionId", "placementId");
CREATE INDEX "AffiliationAgreement_institutionId_employerOrgId_idx" ON "AffiliationAgreement"("institutionId", "employerOrgId");

ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionsApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationOffer" ADD CONSTRAINT "ApplicationOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionsApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationTimelineEvent" ADD CONSTRAINT "ApplicationTimelineEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionsApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_employerOrgId_fkey" FOREIGN KEY ("employerOrgId") REFERENCES "EmployerOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HoursEntry" ADD CONSTRAINT "HoursEntry_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementEvaluation" ADD CONSTRAINT "PlacementEvaluation_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliationAgreement" ADD CONSTRAINT "AffiliationAgreement_employerOrgId_fkey" FOREIGN KEY ("employerOrgId") REFERENCES "EmployerOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
