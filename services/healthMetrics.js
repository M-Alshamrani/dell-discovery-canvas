// services/healthMetrics.js — pure scoring logic for the health heatmap

export function getHealthSummary(session, layers, environments) {
  return {
    totalBuckets:  (layers?.length || 0) * (environments?.length || 0),
    totalCurrent:  (session.instances || []).filter(i => i.state === "current").length,
    totalDesired:  (session.instances || []).filter(i => i.state === "desired").length,
    totalGaps:     (session.gaps || []).length,
    highRiskGaps:  (session.gaps || []).filter(g => g.urgency === "High").length
  };
}

export function computeBucketMetrics(layerId, envId, session) {
  const current = (session.instances || []).filter(
    i => i.state === "current" && i.layerId === layerId && i.environmentId === envId
  );
  let currentScore = 0;
  current.forEach(i => {
    if      (i.criticality === "High")   currentScore += 2;
    else if (i.criticality === "Medium") currentScore += 1;
    else if (i.criticality === "Low")    currentScore += 0.5;
  });

  const gaps = (session.gaps || []).filter(g => {
    const layers = g.affectedLayers?.length ? g.affectedLayers : [g.layerId];
    const envs   = g.affectedEnvironments || [];
    return layers.includes(layerId) && (envs.length === 0 || envs.includes(envId));
  });
  let gapScore = 0;
  gaps.forEach(g => {
    if      (g.urgency === "High")   gapScore += 3;
    else if (g.urgency === "Medium") gapScore += 2;
    else if (g.urgency === "Low")    gapScore += 1;
  });

  const totalScore = currentScore + gapScore;
  const hasData    = current.length > 0 || gaps.length > 0;
  return { totalScore, currentScore, gapScore, hasData, current, gaps };
}

export function scoreToRiskLabel(totalScore, hasData) {
  if (!hasData)         return "No data";
  if (totalScore === 0) return "Stable";
  if (totalScore <= 3)  return "Minor";
  if (totalScore <= 6)  return "Moderate";
  return "High risk";
}

export function scoreToClass(totalScore, hasData) {
  if (!hasData || totalScore === 0) return "bucket-empty";
  if (totalScore <= 3)  return "bucket-low";
  if (totalScore <= 6)  return "bucket-med";
  return "bucket-high";
}
