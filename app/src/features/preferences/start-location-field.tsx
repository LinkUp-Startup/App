import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  describePlace,
  distanceKm,
  FarFromLleidaKm,
  getDeviceLocation,
  LleidaCentre,
  regionFor,
} from '@/features/preferences/location';
import { useTheme } from '@/hooks/use-theme';
import type { GeoPoint } from '@/types/api';

type StartLocationFieldProps = {
  value: GeoPoint | undefined;
  onChange: (value: GeoPoint | undefined) => void;
  /** Max distance in km, drawn as a circle around the start. */
  radiusKm: number;
};

/** Where the group starts (#53): tap the map or use the phone's location. The circle shows the max distance. */
export function StartLocationField({ value, onChange, radiusKm }: StartLocationFieldProps) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  // The street name of a point; only shown while that point is still the start.
  const [named, setNamed] = useState<{ point: GeoPoint; name: string | undefined }>();
  const [message, setMessage] = useState<string>();
  const [locating, setLocating] = useState(false);

  // Keep the start and the whole radius in view.
  useEffect(() => {
    if (value) map.current?.animateToRegion(regionFor(value, radiusKm), 300);
  }, [value, radiusKm]);

  useEffect(() => {
    if (!value) return;
    let current = true;
    describePlace(value).then((name) => {
      if (current) setNamed({ point: value, name });
    });
    return () => {
      current = false;
    };
  }, [value]);
  const place = named?.point === value ? named?.name : undefined;

  async function locateMe() {
    setLocating(true);
    const result = await getDeviceLocation();
    setLocating(false);
    if ('error' in result) {
      setMessage(result.error);
    } else {
      setMessage(undefined);
      onChange(result.point);
    }
  }

  const far = value !== undefined && distanceKm(value, LleidaCentre) > FarFromLleidaKm;

  return (
    <View style={styles.field}>
      <MapView
        ref={map}
        testID="start-location-map"
        style={styles.map}
        initialRegion={regionFor(value ?? LleidaCentre, radiusKm)}
        onPress={(event) => onChange(event.nativeEvent.coordinate)}
        accessibilityLabel="Map. Tap to choose where you start.">
        {value && (
          <>
            <Marker
              coordinate={value}
              title="Start"
              pinColor={theme.tint}
              draggable
              onDragEnd={(event) => onChange(event.nativeEvent.coordinate)}
            />
            <Circle
              center={value}
              radius={radiusKm * 1000}
              strokeColor={theme.tint}
              strokeWidth={2}
              fillColor={`${theme.tint}22`}
            />
          </>
        )}
      </MapView>

      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {value
          ? `Starting at ${place ?? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`}. Venues within ${radiusKm} km.`
          : "Tap the map to set where you start, or use your location. Without a start point, distance isn't used."}
      </ThemedText>
      {far && (
        <ThemedText type="small" themeColor="danger">
          That&apos;s far from Lleida. LinkUp only knows venues in Lleida, so you may get no plans.
        </ThemedText>
      )}
      {message && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      <View style={styles.actions}>
        <Button
          title={locating ? 'Finding you…' : 'Use my location'}
          variant="secondary"
          disabled={locating}
          onPress={locateMe}
          style={styles.action}
        />
        {value && (
          <Button
            title="Clear"
            variant="secondary"
            onPress={() => onChange(undefined)}
            style={styles.action}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  map: {
    borderRadius: 12,
    height: 260,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flexGrow: 1,
  },
});
