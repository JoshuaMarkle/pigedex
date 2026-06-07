"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Button } from "@/components/ui/button";
import L from "leaflet";
import { Plus } from "lucide-react";
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
const releaseIcon = dotIcon("#b1b1b7", 12);
const activeReleaseIcon = dotIcon("#1e96eb", 14);
const tempIcon = dotIcon("#f59e0b", 14);

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
        map.flyToBounds(lb, { padding: [48, 48], maxZoom: 15, duration: 0.6 });
      }
    } catch {
      // ignore
    }
  }, [map, bounds]);

  return null;
}

function MapClickHandler({
  homePos,
  distanceUnit,
  onTempMarker,
  onDeselectFlight,
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      let distance = null;
      if (homePos) {
        const km = haversineKm(homePos[0], homePos[1], lat, lng);
        distance = distanceUnit === "miles" ? km * 0.621371 : km;
      }
      onDeselectFlight?.();
      onTempMarker({ lat, lng, distance });
    },
  });
  return null;
}

// Listens at the map level for popupclose so we can clear the temp marker when
// the user explicitly closes the popup (X button, Escape, or opening another popup).
// We deliberately avoid the Popup-level `remove` event because react-leaflet fires
// it during internal binding/reconciliation — not just on user-triggered close.
function TempMarkerLayer({
  tempMarker,
  homePos,
  distanceUnit,
  onNewFlight,
  onClear,
}) {
  const map = useMap();
  const markerRef = useRef(null);
  const popupRef = useRef(null);
  // Wire up map-level popupclose so we know when the user dismisses the popup.
  // onClear is stable (useCallback in parent) so this only runs once per map instance.
  useEffect(() => {
    function handlePopupClose(e) {
      if (popupRef.current && e.popup === popupRef.current) {
        onClear();
      }
    }
    map.on("popupclose", handlePopupClose);
    return () => map.off("popupclose", handlePopupClose);
  }, [map, onClear]);

  // Open the popup after tempMarker changes. Deferred one rAF so Leaflet's own
  // click-close logic (closePopupOnClick) runs before we re-open.
  useEffect(() => {
    if (!tempMarker || !markerRef.current) return;
    const id = requestAnimationFrame(() => {
      markerRef.current?.openPopup();
    });
    return () => cancelAnimationFrame(id);
  }, [tempMarker]);

  if (!tempMarker) return null;

  return (
    <>
      {homePos && (
        <Polyline
          positions={[[tempMarker.lat, tempMarker.lng], homePos]}
          color="#f59e0b"
          weight={3}
          opacity={0.85}
        />
      )}
      <Marker
        ref={markerRef}
        position={[tempMarker.lat, tempMarker.lng]}
        icon={tempIcon}
        zIndexOffset={2000}
      >
        <Popup ref={popupRef}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {tempMarker.distance != null
                ? `${Math.round(tempMarker.distance)} ${distanceUnit}`
                : "No home location set"}
            </span>
            {onNewFlight && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onNewFlight({ lat: tempMarker.lat, lng: tempMarker.lng })
                }
                title="Log a flight here"
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

/**
 * FlightMap — overview display map.
 *
 * Props:
 *   homeLocation      – { lat, lng, name } | null
 *   flights           – array of { id, locationName, releaseLat, releaseLng, status, distance }
 *   activeFlight      – flight id to highlight (optional)
 *   distanceUnit      – "miles" | "km"
 *   onNewFlight       – ({ lat, lng }) => void — if provided, enables tap-to-create
 *   onSetActiveFlight – (id | null) => void — called when a marker is clicked or map is tapped
 */
export default function FlightMap({
  homeLocation,
  flights = [],
  activeFlight = null,
  distanceUnit = "miles",
  onNewFlight,
  onSetActiveFlight,
}) {
  const [tempMarker, setTempMarker] = useState(null);
  const clearTempMarker = useCallback(() => setTempMarker(null), []);

  const center = homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : [39.5, -98.35];

  const homePos = homeLocation ? [homeLocation.lat, homeLocation.lng] : null;

  const releasePoints = flights.filter(
    (f) => f.releaseLat != null && f.releaseLng != null,
  );

  const activeRelease = releasePoints.find((f) => f.id === activeFlight);
  const activeBounds =
    homePos && activeRelease
      ? [homePos, [activeRelease.releaseLat, activeRelease.releaseLng]]
      : activeRelease
        ? [[activeRelease.releaseLat, activeRelease.releaseLng]]
        : null;

  return (
    <MapContainer
      center={center}
      zoom={homeLocation ? 11 : 3}
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />

      <AutoFit bounds={activeBounds} />
      <MapClickHandler
        homePos={homePos}
        distanceUnit={distanceUnit}
        onTempMarker={setTempMarker}
        onDeselectFlight={() => onSetActiveFlight?.(null)}
      />

      {/* Lines from each release to home */}
      {homePos &&
        [...releasePoints]
          .sort((a, b) =>
            a.id === activeFlight ? 1 : b.id === activeFlight ? -1 : 0,
          )
          .map((f) => {
            const releasePos = [f.releaseLat, f.releaseLng];
            const isActive = f.id === activeFlight;
            return (
              <Polyline
                key={`${f.id}-${isActive}`}
                positions={[releasePos, homePos]}
                color={isActive ? "#1e96eb" : "#b1b1b7"}
                weight={3}
                dashArray={isActive ? null : "10 10"}
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
            zIndexOffset={isActive ? 1000 : 0}
            eventHandlers={{
              click: () => {
                clearTempMarker();
                onSetActiveFlight?.(f.id);
              },
            }}
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

      {/* Temporary marker for tap-to-create */}
      <TempMarkerLayer
        tempMarker={tempMarker}
        homePos={homePos}
        distanceUnit={distanceUnit}
        onNewFlight={onNewFlight}
        onClear={clearTempMarker}
      />
    </MapContainer>
  );
}
