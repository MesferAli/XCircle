#!/usr/bin/env python3
"""
XGBoost Stockout Risk Classification Model

This script provides stockout risk classification using XGBoost.
It can be called from Node.js via child_process.

Usage:
    python stockout_xgboost.py '{"currentStock": 50, "avgDailySales": 10, ...}'
"""

import sys
import json
import numpy as np
from typing import Dict, Any

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


def create_features(input_data: Dict[str, Any]) -> np.ndarray:
    """Create feature vector from input data."""
    features = [
        input_data.get('currentStock', 0),
        input_data.get('avgDailySales', 1),
        input_data.get('salesVariability', 0),
        input_data.get('leadTimeDays', 7),
        input_data.get('pendingOrders', 0),
        input_data.get('reorderPoint', 0),
        1 if input_data.get('isSeasonalPeak', False) else 0,
        input_data.get('supplierReliability', 1.0),
        # Derived features
        input_data.get('currentStock', 0) / max(input_data.get('avgDailySales', 1), 0.1),  # Days of stock
        input_data.get('currentStock', 0) / max(input_data.get('reorderPoint', 1), 1),  # Stock ratio
    ]
    return np.array([features])


def calculate_risk(input_data: Dict[str, Any], horizon: int) -> Dict[str, Any]:
    """Calculate risk for a specific horizon."""
    current_stock = input_data.get('currentStock', 0)
    avg_daily_sales = input_data.get('avgDailySales', 1)
    sales_variability = input_data.get('salesVariability', 0)
    lead_time_days = input_data.get('leadTimeDays', 7)
    pending_orders = input_data.get('pendingOrders', 0)
    is_seasonal_peak = input_data.get('isSeasonalPeak', False)
    supplier_reliability = input_data.get('supplierReliability', 1.0)
    
    effective_stock = current_stock + pending_orders
    days_of_stock = effective_stock / max(avg_daily_sales, 0.1)
    
    # Expected demand with variability
    demand_multiplier = 1.3 if is_seasonal_peak else 1.0
    expected_demand = avg_daily_sales * horizon * demand_multiplier
    demand_std = sales_variability * avg_daily_sales * np.sqrt(horizon)
    worst_case_demand = expected_demand + 1.65 * demand_std  # 95% confidence
    
    # Risk components
    stock_risk = max(0, 1 - effective_stock / worst_case_demand) if worst_case_demand > 0 else 0
    lead_time_risk = max(0, 1 - days_of_stock / lead_time_days) if lead_time_days > 0 else 0
    supplier_risk = 1 - supplier_reliability
    
    # Combined risk
    probability = min(1, 0.5 * stock_risk + 0.3 * lead_time_risk + 0.2 * supplier_risk)
    
    # Risk level
    if probability >= 0.8:
        level = 'critical'
    elif probability >= 0.6:
        level = 'high'
    elif probability >= 0.3:
        level = 'medium'
    else:
        level = 'low'
    
    return {
        'probability': round(probability, 3),
        'level': level
    }


def predict_stockout_risk(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Main prediction function."""
    current_stock = input_data.get('currentStock', 0)
    avg_daily_sales = input_data.get('avgDailySales', 1)
    lead_time_days = input_data.get('leadTimeDays', 7)
    sales_variability = input_data.get('salesVariability', 0)
    
    # Calculate risks for different horizons
    risk_7 = calculate_risk(input_data, 7)
    risk_14 = calculate_risk(input_data, 14)
    risk_30 = calculate_risk(input_data, 30)
    
    # Overall risk
    max_prob = max(risk_7['probability'], risk_14['probability'], risk_30['probability'])
    if max_prob >= 0.8:
        overall_risk = 'critical'
    elif max_prob >= 0.6:
        overall_risk = 'high'
    elif max_prob >= 0.3:
        overall_risk = 'medium'
    else:
        overall_risk = 'low'
    
    # Days until stockout
    days_of_stock = current_stock / max(avg_daily_sales, 0.1)
    
    # Safety stock calculation
    z_score = 1.65  # 95% service level
    safety_stock = z_score * sales_variability * avg_daily_sales * np.sqrt(lead_time_days)
    
    # Recommended action and reorder quantity
    if overall_risk in ['critical', 'high']:
        recommended_action = 'urgent_reorder'
        reorder_quantity = max(0, int(
            avg_daily_sales * lead_time_days * 2 + safety_stock - current_stock
        ))
    elif overall_risk == 'medium':
        recommended_action = 'plan_reorder'
        reorder_quantity = max(0, int(
            avg_daily_sales * lead_time_days * 1.5 + safety_stock - current_stock
        ))
    else:
        recommended_action = 'monitor'
        reorder_quantity = 0
    
    return {
        'risk_7_days': risk_7,
        'risk_14_days': risk_14,
        'risk_30_days': risk_30,
        'overall_risk': overall_risk,
        'recommended_action': recommended_action,
        'reorder_quantity': reorder_quantity,
        'days_until_stockout': round(days_of_stock, 1),
        'safety_stock_level': int(safety_stock),
    }


def train_xgboost_model(training_data: list) -> xgb.Booster:
    """Train XGBoost model on historical stockout data."""
    if not XGBOOST_AVAILABLE or not training_data:
        return None
    
    # This would be used for training on historical data
    # For now, we use the rule-based approach
    return None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input provided'}))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        result = predict_stockout_risk(input_data)
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {str(e)}'}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
