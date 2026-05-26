"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function dotIcon(color, size = 14) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

const homeIcon = dotIcon("#1e96eb", 16);
const releaseIcon = dotIcon("#eb5539", 12);
const activeReleaseIcon = dotIcon("#f59e0b", 14);

function AutoFit({ bounds }) {
  const map = useMap();
  const prev = useRef(null);

  useEffect(() => {
    const key = JSON.stringify(bounds);
    if (key === prev.current || !bounds) return;
    prev.current = key;

    try {
      const lb = L.latLngBounds(bounds.filter(Boolean));
      if (lb.isValid()) {
        map.flyToBounds(lb, { padding: [48, 48], maxZoom: 10, duration: 0.8 });
      }
    } catch {
      // ignore
    }
  }, [map, bounds]);

  return null;
}

/**
 * FlightMap — overview display map.
 *
 * Props:
 *   homeLocation   – { lat, lng, name } | null
 *   flights        – array of { id, locationName, releaseLat, releaseLng, status, distance }
 *   activeFlight   – flight id to highlight (optional)
 *   distanceUnit   – "miles" | "km"
 */
export default function FlightMap({
  homeLocation,
  flights = [],
  activeFlight = null,
  distanceUnit = "miles",
}) {
  const center = homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : [39.5, -98.35];

  const homePos = homeLocation ? [homeLocation.lat, homeLocation.lng] : null;

  const releasePoints = flights.filter(
    (f) => f.releaseLat != null && f.releaseLng != null,
  );

  const allPositions = [
    homePos,
    ...releasePoints.map((f) => [f.releaseLat, f.releaseLng]),
  ].filter(Boolean);

  return (
    <MapContainer
      center={center}
      zoom={homeLocation ? 5 : 3}
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />

      <AutoFit bounds={allPositions.length > 1 ? allPositions : null} />

      {/* Lines from each release to home */}
      {homePos &&
        releasePoints.map((f) => {
          const releasePos = [f.releaseLat, f.releaseLng];
          const isActive = f.id === activeFlight;
          return (
            <Polyline
              key={f.id}
              positions={[releasePos, homePos]}
              color={isActive ? "#f59e0b" : "#1e96eb"}
              weight={isActive ? 3 : 1.5}
              dashArray={isActive ? null : "6 5"}
              opacity={isActive ? 0.9 : 0.5}
            />
          );
        })}

      {/* Release markers */}
      {releasePoints.map((f) => {
        const isActive = f.id === activeFlight;
        const icon = isActive ? activeReleaseIcon : releaseIcon;
        return (
          <Marker
            key={f.id}
            position={[f.releaseLat, f.releaseLng]}
            icon={icon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">
                  {f.locationName ?? "Unknown location"}
                </p>
                {f.distance != null && (
                  <p className="text-muted-foreground">
                    {Math.round(f.distance)} {distanceUnit}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Home marker */}
      {homePos && (
        <Marker position={homePos} icon={homeIcon}>
          <Popup>
            <p className="font-semibold">{homeLocation?.name ?? "Home"}</p>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
