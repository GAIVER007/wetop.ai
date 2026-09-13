// Подгружается в next-server через `node --require` (ADR-034): процесс выходит, как только умер родитель.
// 13.09.2026 `launchctl kickstart -k` добил обёртку стойки SIGKILL, группу процессов launchd не снял,
// и старый next-server остался сиротой. SIGKILL не перехватить — поэтому сирота замечает сама:
// у осиротевшего процесса меняется родитель (ppid становится 1).
const parent = process.ppid;
setInterval(() => {
  if (process.ppid !== parent) process.exit(0);
}, 1000).unref();
