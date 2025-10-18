'use client';
import React, { useState } from 'react';

type Props = {
    src?: string;
    title?: string;
    size?: number;
    className?: string;
    alt?: string;
};

export default function CircleAvatar({
    src,
    title = '',
    size = 40,
    className = '',
    alt = 'Avatar',
}: Props) {
    const [errored, setErrored] = useState(false);
    const initial = (title?.trim()?.[0] ?? '?').toUpperCase();

    if (!src || errored) {
        return (
            <div
                className={`rounded-full flex items-center justify-center font-bold uppercase text-black ${className}`}
                style={{
                    width: size,
                    height: size,
                    background:
                        'radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc',
                    fontSize: Math.max(12, Math.floor(size * 0.4)),
                }}
                aria-hidden="true"
            >
                {initial}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            style={{ width: size, height: size }}
            className={`rounded-full object-cover ${className}`}
            onError={() => setErrored(true)}
        />
    );
}
