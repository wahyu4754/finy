'use client';

import React from 'react';
import {
  Utensils, Car, ShoppingBag, Receipt, Package, 
  Briefcase, Gift, Film, Heart, TrendingUp, 
  Sparkles, Smartphone, Building2, Wallet, 
  HelpCircle, Activity, Shield, Zap, BookOpen, 
  Users, Plane, Camera, Calendar, Flame,
  Coffee, ShoppingCart, Home, Phone, Hammer,
  DollarSign, Landmark, Award
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export const iconMap: Record<string, React.ComponentType<any>> = {
  Utensils, Car, ShoppingBag, Receipt, Package, 
  Briefcase, Gift, Film, Heart, TrendingUp, 
  Sparkles, Smartphone, Building2, Wallet, 
  HelpCircle, Activity, Shield, Zap, BookOpen, 
  Users, Plane, Camera, Calendar, Flame,
  Coffee, ShoppingCart, Home, Phone, Hammer,
  DollarSign, Landmark, Award
};

export const CATEGORY_ICONS = Object.keys(iconMap);

export const CATEGORY_COLORS = [
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#6366F1', // Indigo
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#C5F23C', // Lime Accent
  '#6B7280'  // Gray
];

export default function CategoryIcon({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
}: CategoryIconProps) {
  const IconComponent = iconMap[name] || HelpCircle;
  return <IconComponent size={size} color={color} className={className} />;
}
