import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { DarkMapStyle } from '@/features/preferences/map-style';
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
  const dark = theme === Colors.dark;
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
    // describePlace never rejects (it resolves to undefined on failure), so there's nothing to catch.
    void describePlace(value).then((name) => {
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

  // Choosing a point on the map also clears an earlier "couldn't get your location" message.
  function choose(point: GeoPoint) {
    setMessage(undefined);
    onChange(point);
  }

  const far = value !== undefined && distanceKm(value, LleidaCentre) > FarFromLleidaKm;

  return (
    <View style={styles.field}>
      <View style={styles.mapFrame}>
        <MapView
          ref={map}
          testID="start-location-map"
          style={styles.map}
          userInterfaceStyle={dark ? 'dark' : 'light'}
          customMapStyle={dark ? DarkMapStyle : undefined}
          initialRegion={regionFor(value ?? LleidaCentre, radiusKm)}
          onPress={(event) => choose(event.nativeEvent.coordinate)}
          // On Android a tap on a place icon (a museum, a restaurant) is a POI click, not a map press.
          onPoiClick={(event) => choose(event.nativeEvent.coordinate)}
          accessibilityLabel="Map. Tap to choose where you start.">
          {value && (
            <>
              <Marker
                coordinate={value}
                title="Start"
                pinColor={theme.tint}
                draggable
                onDragEnd={(event) => choose(event.nativeEvent.coordinate)}
              />
              <Circle
                // Android's circle doesn't reliably apply a new center or radius (and comes back with its first
                // values after the map is redrawn), so a new key draws a fresh one whenever either changes.
                key={`${value.latitude},${value.longitude},${radiusKm}`}
                center={value}
                radius={radiusKm * 1000}
                strokeColor={theme.tint}
                strokeWidth={2}
                fillColor={`${theme.tint}22`}
              />
            </>
          )}
        </MapView>
        {value && (
          // Names the start on the map itself, like the design's location tag. Taps pass through to the map.
          <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.tag, { backgroundColor: theme.glass, borderColor: theme.border }]}>
            <Icon name="compass-outline" size={12} color="accent" />
            <ThemedText type="micro" numberOfLines={1} style={styles.tagText}>
              {place ?? 'Start point'}
            </ThemedText>
          </View>
        )}
      </View>

      <ThemedText type="caption" themeColor="textSecondary" accessibilityLiveRegion="polite">
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
          icon="navigate-outline"
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
  mapFrame: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  // A small tag in the corner of the map, like the design's.
  tag: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    left: Spacing.two,
    maxWidth: '80%',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    position: 'absolute',
    top: Spacing.two,
  },
  tagText: {
    flexShrink: 1,
  },
  // 176px tall, as in the design.
  map: {
    borderRadius: Radius.md,
    height: 176,
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
