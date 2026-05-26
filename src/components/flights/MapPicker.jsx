"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon URLs (webpack asset hashing breaks them)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom dot icon factory
function dotIcon(color) {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const homeIcon = dotIcon("#1e96eb");
const releaseIcon = dotIcon("#eb5539");

// Fly to view both markers when they change
function AutoFit({ positions }) {
  const map = useMap();
  const prev = useRef(null);

  useEffect(() => {
    const key = JSON.stringify(positions);
    if (key === prev.current) return;
    prev.current = key;

    const valid = positions.filter(Boolean);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.flyTo(valid[0], Math.max(map.getZoom(), 6), { duration: 0.6 });
    } else {
      map.flyToBounds(L.latLngBounds(valid), {
        padding: [48, 48],
        maxZoom: 9,
        duration: 0.6,
      });
    }
  }, [map, positions]);

  return null;
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * MapPicker — click anywhere to set the release location.
 *
 * Props:
 *   homeLocation  – { lat, lng, name } | null
 *   releaseLocation – { lat, lng } | null
 *   onReleaseChange – (loc | null) => void
 */
export default function MapPicker({
  homeLocation,
  releaseLocation,
  onReleaseChange,
}) {
  const center = homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : [39.5, -98.35]; // continental US fallback

  const zoom = homeLocation ? 5 : 3;

  const homePos = homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : null;
  const releasePos = releaseLocation
    ? [releaseLocation.lat, releaseLocation.lng]
    : null;

  const linePositions =
    homePos && releasePos ? [homePos, releasePos] : null;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "280px", width: "100%", cursor: "crosshair" }}
      className="rounded-lg overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onMapClick={onReleaseChange} />
      <AutoFit positions={[homePos, releasePos]} />

      {homePos && (
        <Marker position={homePos} icon={homeIcon}>
          <Popup>{homeLocation?.name ?? "Home"}</Popup>
        </Marker>
      )}

      {releasePos && (
        <Marker position={releasePos} icon={releaseIcon}>
          <Popup>Release location</Popup>
        </Marker>
      )}

      {linePositions && (
        <Polyline
          positions={linePositions}
          color="#1e96eb"
          weight={2}
          dashArray="6 5"
          opacity={0.7}
        />
      )}
    </MapContainer>
  );
}
