import {test} from "node:test";
import assert from "node:assert/strict";
import {renderAuctionEmail} from "../src/lib/auction/email-template";
import {maskEmail,verificationGuidance,VERIFICATION_COOLDOWN_SECONDS} from "../src/lib/auction/verification";
import {shouldRemindPayment} from "../src/lib/auction/reminders";
test("payment reminders apply only inside the final six hours of an unpaid offer",()=>{
 const now=Date.parse('2026-10-05T01:00:00Z');const offer={status:'pending',deadline:'2026-10-05T07:00:00Z'};
 assert.ok(!shouldRemindPayment(offer,now));assert.ok(shouldRemindPayment(offer,now+1));assert.ok(!shouldRemindPayment({...offer,status:'paid'},now+1));assert.ok(!shouldRemindPayment(offer,now+6*3600_000));
});
test("participant outbid HTML and text show authoritative transition amounts without competing identity",()=>{
 const message=renderAuctionEmail({kind:"outbid",owner:false,qa:true,url:"https://qa.vercel.app/website-auction/bid",payload:{previousAmount:11000,currentHighest:20200,nextMinimum:21200,email:"secret@example.invalid",fullName:"Competing identity",phone:"123456789",businessName:"Private business",endsAt:"2026-10-05T01:00:00Z"},now:Date.parse("2026-10-05T00:00:00Z")});
 for(const body of [message.html,message.text]) {for(const v of ["$110","$202","$212","RETURN TO AUCTION","QA — STRIPE TEST"])assert.ok(body.includes(v));for(const v of ["secret@example.invalid","Competing identity","123456789","Private business"])assert.ok(!body.includes(v));}
 assert.ok(message.html.includes('role="presentation"'));assert.ok(!message.html.includes("<img"));
});
test("email HTML escapes untrusted admin fields and preserves private operational data only for owner",()=>{
 const message=renderAuctionEmail({kind:"bid_accepted",owner:true,qa:true,url:"https://qa.vercel.app/admin/website-auction",payload:{amount:35000,email:"owner-only@example.invalid",fullName:'<script>attack</script>',phone:"555"}});
 assert.ok(message.html.includes("&lt;script&gt;"));assert.ok(!message.html.includes("<script>"));assert.ok(message.text.includes("owner-only@example.invalid"));
});
test("verification guidance masks address and explains deliverability without promising Inbox placement",()=>{
 assert.equal(maskEmail("customer@example.com"),"c•••@example.com");assert.equal(VERIFICATION_COOLDOWN_SECONDS,60);
 const guidance=Object.values(verificationGuidance).join(" ");for(const v of ["Spam","Junk","Promotions","Not spam","outbid","winner","payment confirmation","onboarding","do not guarantee"])assert.ok(guidance.includes(v));
});
