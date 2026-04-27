const secret = process.env.SCHEDULER_SECRET;
if (!secret || secret.length < 8) {
  console.error('SCHEDULER_SECRET is missing or too short');
  process.exit(1);
}
console.log('SCHEDULER_SECRET is set, length:', secret.length, '— OK');
