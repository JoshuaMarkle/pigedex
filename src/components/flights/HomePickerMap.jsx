"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  Popup,
  useMapEvents,
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

const homeIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#1e96eb;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -13],
});

function FlyTo({ location }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!location) return;
    const key = `${location.lat},${location.lng}`;
    if (key === prev.current) return;
    prev.current = key;
    map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 6), {
      duration: 0.6,
    });
  }, [map, location]);
  return null;
}

function ClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * HomePickerMap — click to set / move a single home pin.
 *
 * Props:
 *   location  – { lat, lng } | null
 *   onChange  – ({ lat, lng }) => void
 *   height    – CSS height string (default "260px")
 */
export default function HomePickerMap({
  location,
  onChange,
  height = "260px",
}) {
  const center = location ? [location.lat, location.lng] : [39.5, -98.35];
  const zoom = location ? 15 : 4;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      style={{ height, width: "100%", cursor: "crosshair" }}
      className="rounded-lg overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <ClickHandler onChange={onChange} />
      <FlyTo location={location} />
      {location && (
        <Marker position={[location.lat, location.lng]} icon={homeIcon}>
          <Popup>Home coop</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
