'use client';

import React from 'react';
import Navbar from '../components/Navbar/Navbar';
import StatusBar from '../components/StatusBar';
import '../globals.css';

export default function MainLayout({ children }) {
    return (
        <div className="gps-app">
            <Navbar />
            <StatusBar />
            <main>{children}</main>
        </div>
    );
}
