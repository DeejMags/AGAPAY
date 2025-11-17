import React from 'react';

// Original interactive map embed using OpenStreetMap iframe with zoom controls
export default function MapEmbed({ lat, lng, zoom = 13, height = '300px', rounded = true, showLink = true }) {
	if (typeof lat !== 'number' || typeof lng !== 'number') return null;

	// Build a bbox around the marker so OSM shows appropriate framing
	const bboxPad = 0.01;
	const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - bboxPad}%2C${lat - bboxPad}%2C${lng + bboxPad}%2C${lat + bboxPad}&layer=mapnik&marker=${lat}%2C${lng}`;

	return (
		<div className={`w-full border ${rounded ? 'rounded-lg overflow-hidden' : ''}`} style={{ height }}>
			<iframe
				title="Map"
				src={url}
				style={{ border: 0, width: '100%', height: '100%' }}
				loading="lazy"
				referrerPolicy="no-referrer"
				aria-label="Item location map"
			/>
			{showLink && (
				<div className="p-1 text-xs text-right bg-white/70 -mt-7 relative">
					<a
						href={`https://www.openstreetmap.org/?#map=${zoom}/${lat}/${lng}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-teal-600 hover:underline"
					>
						Open full map
					</a>
				</div>
			)}
		</div>
	);
}

