export type PackageStatus = 'waiting' | 'collected';

export type PackageRecord = {
  id: string;
  apartment: string;
  resident: string;
  carrier: string;
  arrivedAt: string;
  note?: string;
  status: PackageStatus;
  collectedAt?: string;
};

export type AppView = 'doorman' | 'resident';
