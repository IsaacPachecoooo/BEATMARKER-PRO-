
import { Marker, ExportFormat } from '../types';

export const exportMarkers = (markers: Marker[], format: ExportFormat, fileName: string) => {
  let content = '';
  let mimeType = 'text/plain';
  let extension = 'txt';

  const timebase = 60; // Usamos 60fps como base de tiempo para alta precisión en Premiere

  switch (format) {
    case ExportFormat.PREMIERE_XML:
      // Formato Final Cut Pro 7 XML (XMEML), ampliamente soportado por Premiere Pro
      content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>BeatMarker Pro Export</name>
    <children>
      <sequence>
        <name>${fileName.split('.')[0]}_Sequence</name>
        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <track></track>
          </video>
        </media>
        ${markers.map(m => {
          const frame = Math.round(m.time * timebase);
          return `
        <marker>
          <name>${m.label}</name>
          <comment>Beat detectado por BeatMarker Pro</comment>
          <in>${frame}</in>
          <out>${frame}</out>
        </marker>`;
        }).join('')}
      </sequence>
    </children>
  </project>
</xmeml>`;
      mimeType = 'application/xml';
      extension = 'xml';
      break;

    case ExportFormat.AFTER_EFFECTS_JS:
      content = `(function() {
  var layer = app.project.activeItem.selectedLayers[0];
  if (!layer) { alert("¡Selecciona una capa primero!"); return; }
  var markers = ${JSON.stringify(markers)};
  app.beginUndoGroup("Apply Beat Markers");
  for (var i = 0; i < markers.length; i++) {
    var myMarker = new MarkerValue(markers[i].label);
    layer.property("Marker").setValueAtTime(markers[i].time, myMarker);
  }
  app.endUndoGroup();
})();`;
      mimeType = 'application/javascript';
      extension = 'jsx';
      break;

    case ExportFormat.FINAL_CUT_XML:
      content = `<?xml version="1.0" encoding="UTF-8"?>
<fcpxml version="1.8">
  <resources>
    <format id="r1" name="FFVideoFormat1080p24" frameDuration="100/2400s"/>
  </resources>
  <library>
    <event name="BeatMarker Export">
      <project name="Beat Markers">
        <sequence format="r1" duration="3600s">
          <spine>
            ${markers.map(m => `<marker start="${m.time}s" duration="0s" value="${m.label}" />`).join('\n            ')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
      mimeType = 'application/xml';
      extension = 'xml';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName.split('.')[0]}_markers.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
