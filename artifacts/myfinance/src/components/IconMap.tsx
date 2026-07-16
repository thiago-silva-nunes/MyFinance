import React from 'react';
import { 
  Wallet, Briefcase, TrendingUp, Utensils, Car, Home, 
  HeartPulse, GraduationCap, PartyPopper, MoreHorizontal,
  CircleDollarSign, ArrowUpCircle, ArrowDownCircle, AlertCircle
} from 'lucide-react';

export const IconMap: Record<string, React.ElementType> = {
  'wallet': Wallet,
  'briefcase': Briefcase,
  'trending-up': TrendingUp,
  'utensils': Utensils,
  'car': Car,
  'home': Home,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'party-popper': PartyPopper,
  'more-horizontal': MoreHorizontal,
  'circle-dollar-sign': CircleDollarSign,
  'arrow-up-circle': ArrowUpCircle,
  'arrow-down-circle': ArrowDownCircle,
  'alert-circle': AlertCircle
};

export const getIcon = (name: string) => {
  return IconMap[name] || MoreHorizontal;
};
