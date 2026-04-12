import React from 'react';
import { getScoreTier } from '../../utils/leadScoring';

export default function LeadScore({ score }) {
    const tier = getScoreTier(score);

    // Generate explanation based on score logic
    let explanation = '';
    if (score >= 10) explanation = 'Red Hot: No Website Found';
    else if (score >= 8) explanation = 'Warm: Needs HTTPS/Revamp';
    else if (score >= 6) explanation = 'Medium: Low Rating (<3.5⭐)';
    else explanation = 'Low: Has Good Site & Rating';

    return (
        <span className={`lead-score ${tier.class} tooltip-trigger`} data-tooltip={explanation}>
            <span className="lead-score-emoji">{tier.emoji}</span>
            <span className="lead-score-text">{score}</span>
            <div className="custom-tooltip">{explanation}</div>
        </span>
    );
}
