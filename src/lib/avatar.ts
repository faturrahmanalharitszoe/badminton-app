/**
 * Generates a consistent gradient background based on the player's name.
 */
export const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-cyan-500 to-blue-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-violet-500 to-fuchsia-500'
  ];
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Maps a player's ID consistently to one of the 20 downloaded meme jomok images.
 */
export const getJomokAvatar = (playerId: string): string => {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const jomokIndex = (Math.abs(hash) % 20) + 1;
  return `/jomok/jomok_${jomokIndex}.jpg`;
};
