export type PackageStatus = 'waiting' | 'collected';

export type PackageRecord = {
  id: string;
  databaseId: string;
  unitId: string;
  apartment: string;
  building: string;
  resident: string;
  carrier: string;
  arrivedAt: string;
  receivedAt: string;
  note?: string;
  status: PackageStatus;
  collectedAt?: string;
  collectedAtIso?: string;
};

export type AppView = 'doorman' | 'resident';
