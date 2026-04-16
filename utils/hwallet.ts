export function buildChatMessages(message: string, timestamp: number) {
  if (!message.trim()) {
    return [];
  }
  const formattedTime = formatChatTime(timestamp);
  return [
    { id: `u-${timestamp}`, role: 'user', kind: 'text', content: message, time: formattedTime },
    { id: `a-${timestamp}`, role: 'ai', kind: 'text', content: 'AI response placeholder', time: formattedTime },
  ];
}
export function formatChatTime(timestamp: number) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
export function getLoginEmail(email: string) { return email.trim() || 'demo@hwallet.ai'; }
