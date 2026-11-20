/** Dark basemap for Google Maps (Android), to match the night theme. iOS uses `userInterfaceStyle`. */
export const DarkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1b1b1e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#948e9f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#131316' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#494553' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#212225' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2420' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#39393c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#212225' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e11' }] },
];
