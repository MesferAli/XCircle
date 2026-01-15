#!/usr/bin/env python3
"""
Isolation Forest Anomaly Detection Model

This script provides anomaly detection using Isolation Forest.
It can be called from Node.js via child_process.

Usage:
    python anomaly_iforest.py '{"entityId": "...", "metrics": [...]}'
"""

import sys
import json
import numpy as np
from datetime import datetime
from typing import Dict, List, Any

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


def detect_anomalies_iforest(
    historical_values: List[float],
    current_value: float,
    contamination: float = 0.1
) -> Dict[str, Any]:
    """Detect anomaly using Isolation Forest."""
    if not SKLEARN_AVAILABLE or len(historical_values) < 10:
        return detect_anomalies_statistical(historical_values, current_value)
    
    try:
        # Prepare data
        X_train = np.array(historical_values).reshape(-1, 1)
        X_test = np.array([[current_value]])
        
        # Train Isolation Forest
        model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        model.fit(X_train)
        
        # Predict
        prediction = model.predict(X_test)[0]
        score = -model.score_samples(X_test)[0]  # Higher score = more anomalous
        
        is_anomaly = prediction == -1
        
        # Calculate statistics for context
        mean = np.mean(historical_values)
        std = np.std(historical_values)
        deviation = (current_value - mean) / std if std > 0 else 0
        
        return {
            'is_anomaly': is_anomaly,
            'score': float(score),
            'deviation': float(deviation),
            'expected_range': {
                'min': float(mean - 2 * std),
                'max': float(mean + 2 * std)
            }
        }
        
    except Exception as e:
        return detect_anomalies_statistical(historical_values, current_value)


def detect_anomalies_statistical(
    historical_values: List[float],
    current_value: float
) -> Dict[str, Any]:
    """Fallback statistical anomaly detection using Modified Z-Score."""
    if len(historical_values) < 3:
        return {
            'is_anomaly': False,
            'score': 0,
            'deviation': 0,
            'expected_range': {'min': 0, 'max': 0}
        }
    
    # Calculate statistics
    mean = np.mean(historical_values)
    std = np.std(historical_values)
    
    # Modified Z-Score
    if std > 0:
        z_score = abs(current_value - mean) / std
    else:
        z_score = 0
    
    # Anomaly threshold (typically 3 standard deviations)
    is_anomaly = z_score > 2.5
    
    # Normalize score to 0-1 range
    score = min(z_score / 5, 1.0)
    
    return {
        'is_anomaly': is_anomaly,
        'score': float(score),
        'deviation': float((current_value - mean) / std if std > 0 else 0),
        'expected_range': {
            'min': float(mean - 2 * std),
            'max': float(mean + 2 * std)
        }
    }


def get_severity(score: float, deviation: float) -> str:
    """Determine severity based on score and deviation."""
    abs_deviation = abs(deviation)
    
    if score >= 0.8 or abs_deviation >= 4:
        return 'high'
    elif score >= 0.5 or abs_deviation >= 3:
        return 'medium'
    elif score >= 0.3 or abs_deviation >= 2.5:
        return 'low'
    else:
        return 'none'


def detect_anomalies(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Main anomaly detection function."""
    entity_id = input_data.get('entityId', 'unknown')
    entity_type = input_data.get('entityType', 'unknown')
    metrics = input_data.get('metrics', [])
    
    if not metrics:
        return {
            'is_anomaly': False,
            'anomaly_score': 0,
            'severity': 'none',
            'anomalies': [],
            'timestamp': datetime.now().isoformat()
        }
    
    anomalies = []
    max_score = 0
    
    for metric in metrics:
        name = metric.get('name', 'unknown')
        current_value = metric.get('currentValue', 0)
        historical_values = metric.get('historicalValues', [])
        
        if not historical_values:
            continue
        
        # Detect anomaly
        result = detect_anomalies_iforest(historical_values, current_value)
        
        if result['is_anomaly']:
            severity = get_severity(result['score'], result['deviation'])
            
            anomalies.append({
                'metricName': name,
                'currentValue': current_value,
                'expectedRange': result['expected_range'],
                'deviation': result['deviation'],
                'severity': severity
            })
            
            max_score = max(max_score, result['score'])
    
    # Determine overall severity
    if anomalies:
        if any(a['severity'] == 'high' for a in anomalies):
            overall_severity = 'high'
        elif any(a['severity'] == 'medium' for a in anomalies):
            overall_severity = 'medium'
        else:
            overall_severity = 'low'
    else:
        overall_severity = 'none'
    
    return {
        'is_anomaly': len(anomalies) > 0,
        'anomaly_score': round(max_score, 3),
        'severity': overall_severity,
        'anomalies': anomalies,
        'timestamp': datetime.now().isoformat()
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input provided'}))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        result = detect_anomalies(input_data)
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {str(e)}'}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
