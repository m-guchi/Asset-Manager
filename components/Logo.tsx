import React from "react"

interface LogoProps {
    className?: string
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <svg
            width="512"
            height="512"
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M128 384V256M256 384V128M384 384V192"
                stroke="currentColor"
                strokeWidth="42"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M110 300L256 160L400 240"
                stroke="currentColor"
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-60"
            />
            <circle cx="400" cy="240" r="22" fill="currentColor" />
        </svg>
    )
}
