export function containVideoFilter(width,height,{color='0xF5EBD7'}={}) {
  if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0)throw new Error('Video dimensions must be positive integers');
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${color},setsar=1,format=yuv420p`;
}
