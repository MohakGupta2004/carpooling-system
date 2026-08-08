'use client';
/**
 * Central icon registry — Hugeicons (shadcn preset "base-nova"), wrapped so the
 * app keeps the `<CarIcon className="size-4" />` call style.
 */
import {
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Building01Icon,
  Call02Icon,
  Cancel01Icon,
  Car01Icon,
  Cash01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  DashboardCircleIcon,
  Delete02Icon,
  Download01Icon,
  Gps01Icon,
  HistoryIcon,
  Home01Icon,
  Key01Icon,
  Leaf01Icon,
  Loading03Icon,
  Location01Icon,
  LockedIcon,
  Logout01Icon,
  Mail01Icon,
  MapPinpoint01Icon,
  Menu01Icon,
  Notification01Icon,
  PencilEdit01Icon,
  PetrolPumpIcon,
  Plant01Icon,
  PlusSignIcon,
  RoadIcon,
  Route01Icon,
  RupeeIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  SidebarLeft01Icon,
  StarIcon,
  TaxiIcon,
  Tick01Icon,
  UnfoldMoreIcon,
  UserCheck01Icon,
  UserGroup02Icon,
  UserIcon,
  ViewIcon,
  ViewOffIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';

import { type IconType, hi } from './hugeicon';

export type { IconType };

export const CarIcon = hi(Car01Icon);
export const DriveIcon = hi(TaxiIcon);
export const PinIcon = hi(Location01Icon);
export const RouteIcon = hi(Route01Icon);
export const WalletIcon = hi(Wallet01Icon);
export const BellIcon = hi(Notification01Icon);
export const EcoIcon = hi(Leaf01Icon);
export const VerifiedIcon = hi(CheckmarkBadge01Icon);
export const SosIcon = hi(Alert02Icon);
export const SearchIcon = hi(Search01Icon);
export const PlusIcon = hi(PlusSignIcon);
export const UsersIcon = hi(UserGroup02Icon);
export const CompanyIcon = hi(Building01Icon);
export const DashboardIcon = hi(DashboardCircleIcon);
export const HistoryIcon2 = hi(HistoryIcon);
export { HistoryIcon2 as HistoryIcon };
export const ChartIcon = hi(Analytics01Icon);
export const SettingsIcon = hi(Settings01Icon);
export const LogoutIcon = hi(Logout01Icon);
export const IconChevronDown = hi(ArrowDown01Icon);
export const IconChevronRight = hi(ArrowRight01Icon);
export const IconCheck = hi(Tick01Icon);
export const IconX = hi(Cancel01Icon);
export const SpinnerIcon = hi(Loading03Icon);
export const LockIcon = hi(LockedIcon);
export const MailIcon = hi(Mail01Icon);
export const StarIcon2 = hi(StarIcon);
export { StarIcon2 as StarIcon };
export const StarFilledIcon = hi(StarIcon);
export const ClockIcon = hi(Clock01Icon);
export const RupeeIcon2 = hi(RupeeIcon);
export { RupeeIcon2 as RupeeIcon };
export const MenuIcon = hi(Menu01Icon);
export const ApproveIcon = hi(UserCheck01Icon);
export const TreesIcon = hi(Plant01Icon);
export const FuelIcon = hi(PetrolPumpIcon);
export const KeyIcon = hi(Key01Icon);
export const PinpointIcon = hi(MapPinpoint01Icon);

// extras used by the tracking flow
export const PhoneIcon = hi(Call02Icon);
export const SendIcon = hi(SentIcon);
export const CircleCheckIcon = hi(CheckmarkCircle01Icon);
export const CashIcon = hi(Cash01Icon);
export const HomeIcon = hi(Home01Icon);
export const CurrentLocationIcon = hi(Gps01Icon);
export const EditIcon = hi(PencilEdit01Icon);
export const TrashIcon = hi(Delete02Icon);
export const RoadIcon2 = hi(RoadIcon);
export { RoadIcon2 as RoadIcon };
export const SidebarToggleIcon = hi(SidebarLeft01Icon);
export const SelectorIcon = hi(UnfoldMoreIcon);
export const ProfileIcon = hi(UserIcon);
export const DownloadIcon = hi(Download01Icon);
export const EyeIcon = hi(ViewIcon);
export const EyeOffIcon = hi(ViewOffIcon);
