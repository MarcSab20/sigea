export const ALERT_EVENTS = {
  EVASAN:          'alert.evasan',
  VIP:             'alert.vip_detected',
  DANGEROUS_GOODS: 'alert.dangerous_goods',
} as const;

export interface AlertEvasanEvent {
  manifeste_id: string; base_id: string; timestamp: string;
}
export interface AlertVipEvent {
  manifeste_id: string; base_id: string; timestamp: string;
}
export interface AlertDangerousGoodsEvent {
  manifeste_id: string; base_id: string; timestamp: string;
}
