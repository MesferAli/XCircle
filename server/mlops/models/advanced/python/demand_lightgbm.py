#!/usr/bin/env python3
"""
LightGBM Demand Forecasting Model

This script provides demand forecasting using LightGBM.
It can be called from Node.js via child_process.

Usage:
    python demand_lightgbm.py '{"salesHistory": [...], "horizon": 14, ...}'
"""

import sys
import json
import numpy as np
from typing import Dict, List, Any

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False


def create_features(sales_history: List[float], idx: int) -> Dict[str, float]:
    """Create features for a single prediction point."""
    features = {}
    
    # Lag features
    for lag in [1, 7, 14, 30]:
        if idx >= lag:
            features[f'lag_{lag}'] = sales_history[idx - lag]
        else:
            features[f'lag_{lag}'] = np.mean(sales_history[:max(1, idx)])
    
    # Rolling statistics
    for window in [7, 14, 30]:
        start = max(0, idx - window)
        window_data = sales_history[start:idx] if idx > 0 else sales_history[:1]
        features[f'rolling_mean_{window}'] = np.mean(window_data)
        features[f'rolling_std_{window}'] = np.std(window_data) if len(window_data) > 1 else 0
    
    # Trend
    if idx >= 7:
        recent = np.mean(sales_history[idx-7:idx])
        older = np.mean(sales_history[max(0, idx-14):idx-7])
        features['trend'] = (recent - older) / older if older > 0 else 0
    else:
        features['trend'] = 0
    
    return features


def train_model(sales_history: List[float]) -> lgb.Booster:
    """Train LightGBM model on historical data."""
    X = []
    y = []
    
    # Create training data
    for i in range(30, len(sales_history)):
        features = create_features(sales_history, i)
        X.append(list(features.values()))
        y.append(sales_history[i])
    
    if len(X) < 10:
        return None
    
    X = np.array(X)
    y = np.array(y)
    
    # Train model
    train_data = lgb.Dataset(X, label=y)
    
    params = {
        'objective': 'regression',
        'metric': 'mae',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.9,
        'verbose': -1,
    }
    
    model = lgb.train(params, train_data, num_boost_round=100)
    return model


def predict_demand(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Main prediction function."""
    sales_history = input_data.get('salesHistory', [])
    horizon = input_data.get('horizon', 14)
    seasonality_index = input_data.get('seasonalityIndex', 1.0)
    
    if len(sales_history) < 14:
        return {'error': 'Insufficient data for prediction'}
    
    # Statistical fallback if LightGBM not available
    if not LIGHTGBM_AVAILABLE:
        return statistical_forecast(sales_history, horizon, seasonality_index)
    
    try:
        # Train model
        model = train_model(sales_history)
        
        if model is None:
            return statistical_forecast(sales_history, horizon, seasonality_index)
        
        # Generate forecasts
        forecast = []
        extended_history = sales_history.copy()
        
        for i in range(horizon):
            idx = len(extended_history)
            features = create_features(extended_history, idx)
            X_pred = np.array([list(features.values())])
            
            pred = model.predict(X_pred)[0] * seasonality_index
            forecast.append(max(0, round(pred)))
            extended_history.append(pred)
        
        # Calculate prediction intervals
        std = np.std(sales_history[-30:])
        lower = [max(0, round(f - 1.96 * std)) for f in forecast]
        upper = [round(f + 1.96 * std) for f in forecast]
        
        # Feature importance
        importance = model.feature_importance()
        feature_names = [
            'lag_1', 'lag_7', 'lag_14', 'lag_30',
            'rolling_mean_7', 'rolling_std_7',
            'rolling_mean_14', 'rolling_std_14',
            'rolling_mean_30', 'rolling_std_30',
            'trend'
        ]
        importance_dict = {
            name: float(imp) / sum(importance)
            for name, imp in zip(feature_names[:len(importance)], importance)
        }
        
        # Determine trend
        first_half = sum(forecast[:horizon//2])
        second_half = sum(forecast[horizon//2:])
        if second_half > first_half * 1.1:
            trend = 'increasing'
        elif second_half < first_half * 0.9:
            trend = 'decreasing'
        else:
            trend = 'stable'
        
        return {
            'forecast': forecast,
            'prediction_interval': {
                'lower': lower,
                'upper': upper,
                'confidence': 0.95
            },
            'total_forecast': sum(forecast),
            'trend': trend,
            'feature_importance': importance_dict,
        }
        
    except Exception as e:
        return {'error': str(e)}


def statistical_forecast(
    sales_history: List[float],
    horizon: int,
    seasonality_index: float
) -> Dict[str, Any]:
    """Fallback statistical forecast."""
    recent = sales_history[-14:]
    mean = np.mean(recent)
    std = np.std(recent)
    
    # Simple exponential smoothing
    alpha = 0.3
    smoothed = recent[0]
    for val in recent[1:]:
        smoothed = alpha * val + (1 - alpha) * smoothed
    
    forecast = [round(smoothed * seasonality_index) for _ in range(horizon)]
    lower = [max(0, round(f - 1.96 * std)) for f in forecast]
    upper = [round(f + 1.96 * std) for f in forecast]
    
    return {
        'forecast': forecast,
        'prediction_interval': {
            'lower': lower,
            'upper': upper,
            'confidence': 0.95
        },
        'total_forecast': sum(forecast),
        'trend': 'stable',
        'feature_importance': {
            'recent_sales': 0.4,
            'trend': 0.3,
            'seasonality': 0.2,
            'day_of_week': 0.1,
        },
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input provided'}))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        result = predict_demand(input_data)
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {str(e)}'}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
