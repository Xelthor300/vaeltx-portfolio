export function shouldRemindPayment(offer:{status:string;deadline:string},now:number) {
  const remaining=Date.parse(offer.deadline)-now;
  return offer.status === "pending" && remaining > 0 && remaining < 6*3600_000;
}
