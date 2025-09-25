"use client";

import React from 'react';

// SVG Icons for macOS window controls - they appear on hover
const CloseIcon = () => (
  <svg x="0px" y="0px" viewBox="0 0 6.4 6.4" className="w-[6px] h-[6px]">
    <polygon fill="#4d0000" points="6.4,0.8 5.6,0 3.2,2.4 0.8,0 0,0.8 2.4,3.2 0,5.6 0.8,6.4 3.2,4 5.6,6.4 6.4,5.6 4,3.2"></polygon>
  </svg>
);

const MinimizeIcon = () => (
  <svg x="0px" y="0px" viewBox="0 0 8 1.1" className="w-[6px] h-[6px]">
    <rect fill="#995700" width="8" height="1.1"></rect>
  </svg>
);

const MaximizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" className="w-[6px] h-[6px]" fill="#006400">
        <path d="M13.5 0H.5C.224 0 0 .224 0 .5v13c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5V.5c0-.276-.224-.5-.5-.5zM13 13H1V1h12v12z" />
        <path d="M11 5H3v1h8V5zM8 3H6v8h2V3z" />
    </svg>
);


export default function TitleBar() {
  // Mock electron functions for browser preview
  const handleMinimize = () => window.electron.minimizeWindow();

  const handleMaximize = () => window.electron.maximizeWindow();

  const handleClose = () => window.electron.closeWindow();

  return (
        <div className="title-bar">
            <div className="title-bar-text">Arkalogi Amibroker Upstox Data Plugin</div>
            <div className="window-controls">
                <button className="title-bar-button" id="minimize-btn" onClick={handleMinimize}>
                    <MinimizeIcon />
                </button>
                <button className="title-bar-button" id="maximize-btn" onClick={handleMaximize}>
                    <MaximizeIcon />
                </button>
                <button className="title-bar-button" id="close-btn" onClick={handleClose}>
                    <CloseIcon />
                </button>
            </div>
        </div>
  );
}

