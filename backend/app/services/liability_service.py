import dataclasses
from datetime import date, datetime, timedelta
from typing import Any, cast

from app.exceptions import NoResultFoundError, QueryExecutionError
from app.logger import get_logger
from app.models import Liability, LiabilityPaymentDetail
from app.services.base_service import BaseService, ListQueryParams
import requests


class LiabilityService(BaseService[Liability]):
    """Service for managing liabilities."""

    def __init__(self) -> None:
        super().__init__("liabilities", Liability)
        self.logger = get_logger(__name__)

    def get_by_id(self, item_id: int, user_id: int) -> dict[str, Any] | None:
        """Get a liability by ID, augmented with details from liability_balances view."""
        liability_obj = super().get_by_id(item_id=item_id, user_id=user_id)

        if not liability_obj:
            return None

        liability_dict = dataclasses.asdict(liability_obj)

        # Ensure date/datetime objects are ISO formatted strings in the base dict
        if isinstance(liability_dict.get("start_date"), date):
            liability_dict["start_date"] = liability_dict["start_date"].isoformat()
        if isinstance(liability_dict.get("end_date"), date):
            liability_dict["end_date"] = liability_dict["end_date"].isoformat()
        if isinstance(liability_dict.get("created_at"), datetime):
            liability_dict["created_at"] = liability_dict["created_at"].isoformat()
        if isinstance(liability_dict.get("updated_at"), datetime):
            liability_dict["updated_at"] = liability_dict["updated_at"].isoformat()

        query = """--sql
            SELECT
                principal_paid,
                interest_paid,
                remaining_balance,
                missed_payments_count,
                next_payment_date
            FROM liability_balances
            WHERE liability_id = ? AND user_id = ?
        """
        balance_result = self.db_manager.execute_select(query, [item_id, user_id])

        if balance_result:
            balance_data = balance_result[0]
            liability_dict["principal_paid"] = balance_data.get("principal_paid", 0.0)
            liability_dict["interest_paid"] = balance_data.get("interest_paid", 0.0)
            liability_dict["remaining_balance"] = balance_data.get(
                "remaining_balance", liability_dict["principal_amount"]
            )
            liability_dict["missed_payments_count"] = balance_data.get(
                "missed_payments_count", 0
            )
            next_payment_date_val = balance_data.get("next_payment_date")
            if isinstance(next_payment_date_val, date):
                liability_dict["next_payment_date"] = next_payment_date_val.isoformat()
            elif isinstance(next_payment_date_val, str):
                liability_dict["next_payment_date"] = (
                    next_payment_date_val  # Already a string
                )
            else:
                liability_dict["next_payment_date"] = None
        else:
            # Set defaults if no balance data found
            liability_dict["principal_paid"] = 0.0
            liability_dict["interest_paid"] = 0.0
            liability_dict["remaining_balance"] = liability_dict.get(
                "principal_amount", 0.0
            )
            liability_dict["missed_payments_count"] = 0
            liability_dict["next_payment_date"] = None

        return liability_dict

    def get_all(self, user_id: int, query_params: ListQueryParams) -> dict[str, Any]:
        """Get all liabilities with additional details.

        Overrides the base method to include details from the liability_balances view.
        The items in result["items"] from super().get_all are dictionaries.
        """
        result = super().get_all(user_id, query_params)

        if not result.get("items"):
            return result

        liability_ids = [item["id"] for item in result["items"] if "id" in item]
        if not liability_ids:
            return result

        placeholders = ", ".join(["?"] * len(liability_ids))
        query = f"""--sql
            SELECT
                liability_id,
                principal_paid,
                interest_paid,
                remaining_balance,
                missed_payments_count,
                next_payment_date
            FROM liability_balances
            WHERE liability_id IN ({placeholders}) AND user_id = ?
        """  # noqa: S608
        params = [*liability_ids, user_id]
        details_list = self.db_manager.execute_select(query, params)

        details_lookup = {detail["liability_id"]: detail for detail in details_list}

        for item in result["items"]:
            liability_id = item.get("id")
            detail = details_lookup.get(liability_id) if liability_id else None

            item["principal_paid"] = (
                detail.get("principal_paid", 0.0) if detail else 0.0
            )
            item["interest_paid"] = detail.get("interest_paid", 0.0) if detail else 0.0
            item["remaining_balance"] = (
                detail.get("remaining_balance", item.get("principal_amount", 0.0))
                if detail
                else item.get("principal_amount", 0.0)
            )
            item["missed_payments_count"] = (
                detail.get("missed_payments_count", 0) if detail else 0
            )
            next_payment_date_val = detail.get("next_payment_date") if detail else None
            if next_payment_date_val and isinstance(next_payment_date_val, date):
                item["next_payment_date"] = next_payment_date_val.isoformat()
            elif isinstance(next_payment_date_val, str):  # Assuming YYYY-MM-DD
                item["next_payment_date"] = next_payment_date_val
            else:
                item["next_payment_date"] = None

        return result

    def get_with_details(self, liability_id: int, user_id: int) -> dict[str, Any]:
        """Get a liability with its details from the view. Returns a dict."""
        return self.get_by_id(liability_id, user_id) or {}

    def get_all_with_details(
        self, user_id: int, query_params: ListQueryParams
    ) -> dict[str, Any]:
        """Get all liabilities with details from the view. Returns a dict with a list of dicts."""
        return self.get_all(user_id, query_params)  # get_all already returns a dict

    def generate_amortization_schedule(
        self, liability_id: int, user_id: int
    ) -> list[dict[str, Any]]:
        """Generate an amortization schedule for a liability, considering actual payments.

        Handles different deferral types:
        - none: Standard loan with immediate payments
        - partial: Only interest is paid during deferral period
        - total: No payments during deferral period, interest is capitalized
        """
        liability_data = self.get_by_id(
            liability_id, user_id
        )  # Now returns a dict or None
        if not liability_data:
            return []

        start_date_str = liability_data["start_date"]
        end_date_str = liability_data.get("end_date")

        current_start_date = (
            datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if start_date_str
            else date.today()
        )
        current_end_date = (
            datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else None
        )

        principal_amount = cast("float", liability_data["principal_amount"])
        interest_rate = cast("float", liability_data["interest_rate"])
        compounding_period = cast("str", liability_data["compounding_period"])
        payment_frequency = cast("str", liability_data["payment_frequency"])
        liability_payment_amount = liability_data.get("payment_amount")  # Can be None
        deferral_period_months = cast(
            "int", liability_data.get("deferral_period_months", 0)
        )
        deferral_type = cast("str", liability_data.get("deferral_type", "none"))

        payment_service = LiabilityPaymentDetailService()
        raw_existing_payments = payment_service.get_all_for_liability(
            liability_id, user_id
        )

        # Group payments by date and create a date tolerance window map
        existing_payments_map: dict[date, list[dict[str, Any]]] = {}
        date_to_payments_map: dict[str, list[dict[str, Any]]] = {}  # ISO date string to payments

        for p_dict in raw_existing_payments:
            p_date_val = p_dict["payment_date"]
            # Assuming payment_date from DB is already a string in YYYY-MM-DD via service/model
            p_date_obj = datetime.strptime(str(p_date_val), "%Y-%m-%d").date()
            p_date_iso = p_date_obj.isoformat()

            if p_date_obj not in existing_payments_map:
                existing_payments_map[p_date_obj] = []
            existing_payments_map[p_date_obj].append(p_dict)

            if p_date_iso not in date_to_payments_map:
                date_to_payments_map[p_date_iso] = []
            date_to_payments_map[p_date_iso].append(p_dict)

        # Create a tolerance window for payment matching (±5 days)
        tolerance_days = 5
        payment_window_map: dict[date, list[date]] = {}
        for payment_date in existing_payments_map.keys():
            # Create a window of dates for each payment date
            window_start = payment_date - timedelta(days=tolerance_days)
            window_end = payment_date + timedelta(days=tolerance_days)
            current_window_date = window_start
            while current_window_date <= window_end:
                if current_window_date not in payment_window_map:
                    payment_window_map[current_window_date] = []
                payment_window_map[current_window_date].append(payment_date)
                current_window_date += timedelta(days=1)

        schedule: list[dict[str, Any]] = []
        current_date = current_start_date
        balance_before_payment = round(principal_amount, 2)
        payment_number = 0
        capitalized_interest = 0.0  # Track interest that's been capitalized

        period_interest_rate = self._get_period_interest_rate(
            interest_rate, compounding_period, payment_frequency
        )

        theoretical_pmt = liability_payment_amount
        P_for_pmt_calc = principal_amount  # Define P for the else block
        r_for_pmt_calc = period_interest_rate  # Define r for the else block

        # Calculate total number of payments (including deferral period)
        total_periods = 0
        if current_end_date:
            total_periods = self._calculate_number_of_payments(
                current_start_date, current_end_date, payment_frequency
            )

        # Calculate deferral end date
        deferral_end_date = (
            self._add_months(current_start_date, deferral_period_months)
            if deferral_period_months > 0
            else None
        )

        # Calculate remaining payments after deferral
        non_deferred_periods = 0
        if deferral_end_date and current_end_date:
            non_deferred_periods = self._calculate_number_of_payments(
                deferral_end_date, current_end_date, payment_frequency
            )
        elif total_periods > 0 and deferral_period_months > 0:
            non_deferred_periods = total_periods - deferral_period_months

        # Calculate payment amount (if not provided) based on amortization after deferral
        if not theoretical_pmt and current_end_date:
            if non_deferred_periods > 0:
                # For loans with deferral, recalculate theoretical payment using just the non-deferred period
                # First, estimate the principal amount at the end of deferral
                estimated_principal_after_deferral = principal_amount
                if deferral_type == "total":
                    # For "total" deferral, interest is capitalized during deferral
                    for _ in range(deferral_period_months):
                        monthly_interest = estimated_principal_after_deferral * (interest_rate / 100 / 12)
                        estimated_principal_after_deferral += monthly_interest

                # Now calculate the payment using the estimated principal and non-deferred periods
                P_for_pmt_calc = estimated_principal_after_deferral
                r_for_pmt_calc = period_interest_rate

                # Calculate payment using standard amortization formula
                if r_for_pmt_calc == 0:
                    theoretical_pmt = (
                        round(P_for_pmt_calc / non_deferred_periods, 2) if non_deferred_periods > 0 else P_for_pmt_calc
                    )
                else:
                    theoretical_pmt = round(
                        P_for_pmt_calc
                        * r_for_pmt_calc
                        * (1 + r_for_pmt_calc) ** non_deferred_periods
                        / ((1 + r_for_pmt_calc) ** non_deferred_periods - 1),
                        2,
                    )
            elif total_periods > 0:
                # Standard calculation for total periods
                if r_for_pmt_calc == 0:
                    theoretical_pmt = (
                        round(P_for_pmt_calc / total_periods, 2) if total_periods > 0 else P_for_pmt_calc
                    )
                else:
                    theoretical_pmt = round(
                        P_for_pmt_calc
                        * r_for_pmt_calc
                        * (1 + r_for_pmt_calc) ** total_periods
                        / ((1 + r_for_pmt_calc) ** total_periods - 1),
                        2,
                    )
            else:
                # Default calculation if no periods can be calculated
                theoretical_pmt = (
                    round(P_for_pmt_calc * (1 + r_for_pmt_calc), 2)
                    if r_for_pmt_calc > 0
                    else P_for_pmt_calc
                )
        elif not theoretical_pmt:
            theoretical_pmt = round(principal_amount * period_interest_rate, 2)

        processed_actual_payment_ids: set[int | None] = set()

        # Log details about the deferral
        if deferral_period_months > 0:
            self.logger.info(
                f"Liability {liability_id}: Deferral type '{deferral_type}' for {deferral_period_months} months "
                f"until {deferral_end_date.isoformat() if deferral_end_date else 'N/A'}"
            )
            self.logger.info(
                f"Estimated payment after deferral: {theoretical_pmt}"
            )

        while True:
            payment_number += 1
            if payment_number > 1200:  # Safety limit
                break

            is_deferred_this_period = bool(
                deferral_end_date and current_date < deferral_end_date
            )
            interest_for_period = round(
                balance_before_payment * period_interest_rate, 2
            )

            current_schedule_item: dict[str, Any] | None = None
            current_remaining_principal = balance_before_payment  # Initialize for all paths

            # First check exact date match
            actual_payments_for_current_date = existing_payments_map.get(
                current_date, []
            )

            # If no exact match, check payments within the tolerance window
            if not actual_payments_for_current_date and current_date in payment_window_map:
                closest_payment_date = None
                min_days_diff = float('inf')

                # Find the closest payment date within the window
                for potential_date in payment_window_map[current_date]:
                    days_diff = abs((potential_date - current_date).days)
                    if days_diff < min_days_diff:
                        min_days_diff = days_diff
                        closest_payment_date = potential_date

                if closest_payment_date:
                    actual_payments_for_current_date = existing_payments_map.get(closest_payment_date, [])

            unprocessed_actual_payments = [
                p
                for p in actual_payments_for_current_date
                if p.get("transaction_id") not in processed_actual_payment_ids
            ]

            if unprocessed_actual_payments:
                # Handle actual payments, even in deferral periods
                actual_payment = unprocessed_actual_payments[0]
                payment_amount_actual = round(
                    cast("float", actual_payment["amount"]), 2
                )
                paid_principal = round(
                    cast("float", actual_payment["principal_amount"]), 2
                )
                paid_interest = round(
                    cast("float", actual_payment["interest_amount"]), 2
                )
                extra_payment = round(
                    cast("float", actual_payment.get("extra_payment", 0.0)), 2
                )

                # Use the actual payment date
                payment_date = (
                    datetime.strptime(str(actual_payment["payment_date"]), "%Y-%m-%d").date()
                    if isinstance(actual_payment["payment_date"], str)
                    else actual_payment["payment_date"]
                )

                # If we're in a deferral period, adjust how the payment is applied
                if is_deferred_this_period:
                    if deferral_type == "total":
                        # For total deferral, actual payments go entirely to principal
                        # since interest is capitalized
                        if paid_principal == 0 and paid_interest == 0:
                            # If principal/interest split not specified, apply all to principal
                            paid_principal = payment_amount_actual
                            paid_interest = 0

                        # Since we're still capitalizing interest in this period,
                        # track it separately
                        capitalized_interest += interest_for_period
                        current_remaining_principal = round(
                            balance_before_payment + interest_for_period - paid_principal, 2
                        )
                    elif deferral_type == "partial":
                        # For partial deferral, payment goes to interest first, then principal
                        if paid_principal == 0 and paid_interest == 0:
                            # If principal/interest split not specified
                            paid_interest = min(payment_amount_actual, interest_for_period)
                            paid_principal = payment_amount_actual - paid_interest

                        current_remaining_principal = round(
                            balance_before_payment - paid_principal, 2
                        )
                    else:  # None or unexpected type
                        current_remaining_principal = round(
                            balance_before_payment - paid_principal, 2
                        )
                else:
                    # Normal payment outside deferral period
                    current_remaining_principal = round(
                        balance_before_payment - paid_principal, 2
                    )

                current_schedule_item = {
                    "payment_number": payment_number,
                    "payment_date": payment_date.isoformat(),
                    "scheduled_date": current_date.isoformat(),
                    "payment_amount": payment_amount_actual,
                    "principal_amount": paid_principal,
                    "interest_amount": paid_interest,
                    "capitalized_interest": 0.0,  # No capitalization for actual payments
                    "remaining_principal": current_remaining_principal,
                    "transaction_id": actual_payment.get("transaction_id"),
                    "is_actual_payment": True,
                    "extra_payment": extra_payment,
                    "date_shifted": payment_date != current_date,
                    "is_deferred": is_deferred_this_period,
                    "deferral_type": deferral_type if is_deferred_this_period else "none"
                }

                processed_actual_payment_ids.add(
                    cast("int | None", actual_payment.get("transaction_id"))
                )

                # Log date shifts for debugging
                if payment_date != current_date:
                    self.logger.info(
                        f"Payment date shifted: scheduled {current_date}, actual {payment_date}, "
                        f"amount: {payment_amount_actual}, transaction_id: {actual_payment.get('transaction_id')}"
                    )
            else:
                # Handle theoretical payments
                theoretical_principal_paid = 0.0
                theoretical_interest_paid = 0.0
                current_theoretical_payment_amount = theoretical_pmt or 0
                capitalized_interest_this_period = 0.0

                if is_deferred_this_period:
                    if deferral_type == "total":
                        # No payment during total deferral, interest capitalizes
                        theoretical_interest_paid = 0  # No interest paid
                        theoretical_principal_paid = 0  # No principal paid
                        capitalized_interest_this_period = interest_for_period  # Interest gets capitalized
                        current_remaining_principal = round(
                            balance_before_payment + interest_for_period, 2
                        )
                        current_theoretical_payment_amount = 0
                    elif deferral_type == "partial":
                        # Only interest is paid during partial deferral
                        theoretical_interest_paid = interest_for_period
                        theoretical_principal_paid = 0
                        current_theoretical_payment_amount = theoretical_interest_paid
                        current_remaining_principal = balance_before_payment  # Principal stays the same
                    else:  # "none" or unexpected value
                        # Standard payment calculation even during "deferral period"
                        theoretical_interest_paid = interest_for_period
                        theoretical_principal_paid = round(
                            current_theoretical_payment_amount - theoretical_interest_paid,
                            2,
                        )
                        theoretical_principal_paid = max(theoretical_principal_paid, 0)
                        theoretical_principal_paid = min(
                            theoretical_principal_paid, balance_before_payment
                        )
                        current_theoretical_payment_amount = round(
                            theoretical_principal_paid + theoretical_interest_paid, 2
                        )
                        current_remaining_principal = round(
                            balance_before_payment - theoretical_principal_paid, 2
                        )
                else:
                    # First payment after deferral might need a recalculated amount
                    if deferral_end_date and current_date == deferral_end_date:
                        # First payment after deferral - payment amount might be different
                        if not liability_payment_amount:  # Only if payment not explicitly set
                            # Recalculate theoretical payment based on remaining balance and periods
                            remaining_periods = self._calculate_number_of_payments(
                                current_date, current_end_date, payment_frequency
                            )
                            if r_for_pmt_calc > 0 and remaining_periods > 0:
                                theoretical_pmt = round(
                                    balance_before_payment
                                    * r_for_pmt_calc
                                    * (1 + r_for_pmt_calc) ** remaining_periods
                                    / ((1 + r_for_pmt_calc) ** remaining_periods - 1),
                                    2,
                                )
                                current_theoretical_payment_amount = theoretical_pmt
                                self.logger.info(
                                    f"First payment after deferral: Recalculated payment amount to {theoretical_pmt}"
                                )

                    # Standard amortization calculation
                    theoretical_interest_paid = interest_for_period
                    theoretical_principal_paid = round(
                        current_theoretical_payment_amount - theoretical_interest_paid,
                        2,
                    )
                    theoretical_principal_paid = max(theoretical_principal_paid, 0)
                    theoretical_principal_paid = min(
                        theoretical_principal_paid, balance_before_payment
                    )
                    current_theoretical_payment_amount = round(
                        theoretical_principal_paid + theoretical_interest_paid, 2
                    )
                    current_remaining_principal = round(
                        balance_before_payment - theoretical_principal_paid, 2
                    )

                current_schedule_item = {
                    "payment_number": payment_number,
                    "payment_date": current_date.isoformat(),
                    "scheduled_date": current_date.isoformat(),  # Same as payment_date for theoretical payments
                    "payment_amount": current_theoretical_payment_amount,
                    "principal_amount": theoretical_principal_paid,
                    "interest_amount": theoretical_interest_paid,
                    "capitalized_interest": capitalized_interest_this_period,
                    "remaining_principal": current_remaining_principal,
                    "transaction_id": None,
                    "is_actual_payment": False,
                    "extra_payment": 0.0,
                    "date_shifted": False,  # No shift for theoretical payments
                    "is_deferred": is_deferred_this_period,
                    "deferral_type": deferral_type if is_deferred_this_period else "none"
                }

            if current_schedule_item:
                schedule.append(current_schedule_item)
                balance_before_payment = current_remaining_principal  # Use the updated one
                capitalized_interest += capitalized_interest_this_period if 'capitalized_interest_this_period' in locals() else 0

            # Determine when to exit the loop
            if round(balance_before_payment, 2) <= 0 and not is_deferred_this_period:
                # Stop if balance is paid off and we're not in a deferral period
                break

            if current_end_date and current_date >= current_end_date:
                # Stop if we've reached or passed the end date
                break

            current_date = self._get_next_payment_date(current_date, payment_frequency)
            if (
                current_end_date
                and current_date > current_end_date
                and round(balance_before_payment, 2) > 0
            ):
                # If we've passed the end date but still have balance,
                # add one final payment to the schedule
                final_payment_date = current_end_date
                final_payment = {
                    "payment_number": payment_number + 1,
                    "payment_date": final_payment_date.isoformat(),
                    "scheduled_date": final_payment_date.isoformat(),
                    "payment_amount": round(balance_before_payment + (balance_before_payment * period_interest_rate), 2),
                    "principal_amount": balance_before_payment,
                    "interest_amount": round(balance_before_payment * period_interest_rate, 2),
                    "capitalized_interest": 0.0,
                    "remaining_principal": 0.0,
                    "transaction_id": None,
                    "is_actual_payment": False,
                    "extra_payment": 0.0,
                    "date_shifted": False,
                    "is_deferred": False,
                    "deferral_type": "none",
                    "is_final_balloon_payment": True,
                }
                schedule.append(final_payment)
                break

        # Handle additional payments that may have been made outside the regular schedule
        all_actual_payment_dates = sorted(existing_payments_map.keys())
        last_scheduled_date_iso = (
            schedule[-1]["payment_date"] if schedule else current_start_date.isoformat()
        )
        last_date_obj = datetime.strptime(last_scheduled_date_iso, "%Y-%m-%d").date()

        for p_date in all_actual_payment_dates:
            if p_date > last_date_obj:
                for actual_payment in existing_payments_map.get(p_date, []):
                    if (
                        actual_payment.get("transaction_id")
                        not in processed_actual_payment_ids
                    ):
                        payment_number += 1
                        prev_balance = (
                            schedule[-1]["remaining_principal"] if schedule else 0.0
                        )
                        actual_paid_principal = cast(
                            "float", actual_payment["principal_amount"]
                        )
                        current_schedule_item = {
                            "payment_number": payment_number,
                            "payment_date": p_date.isoformat(),
                            "scheduled_date": p_date.isoformat(),  # For additional payments, use actual date as scheduled
                            "payment_amount": round(
                                cast("float", actual_payment["amount"]), 2
                            ),
                            "principal_amount": round(actual_paid_principal, 2),
                            "interest_amount": round(
                                cast("float", actual_payment["interest_amount"]), 2
                            ),
                            "capitalized_interest": 0.0,
                            "remaining_principal": round(
                                prev_balance - actual_paid_principal, 2
                            ),
                            "transaction_id": actual_payment.get("transaction_id"),
                            "is_actual_payment": True,
                            "extra_payment": round(
                                cast("float", actual_payment.get("extra_payment", 0.0)),
                                2,
                            ),
                            "date_shifted": False,  # Not considered shifted for extra payments
                            "is_deferred": False,
                            "deferral_type": "none"
                        }
                        schedule.append(current_schedule_item)
                        processed_actual_payment_ids.add(
                            cast("int | None", actual_payment.get("transaction_id"))
                        )

        # Add summary information
        total_interest_paid = sum(item.get("interest_amount", 0) for item in schedule)
        total_principal_paid = sum(item.get("principal_amount", 0) for item in schedule)
        total_capitalized_interest = sum(item.get("capitalized_interest", 0) for item in schedule)

        if schedule:
            schedule[-1]["total_interest_paid"] = total_interest_paid
            schedule[-1]["total_principal_paid"] = total_principal_paid
            schedule[-1]["total_capitalized_interest"] = total_capitalized_interest

        return schedule

    def _get_period_interest_rate(
        self, annual_rate: float, compounding_period: str, payment_frequency: str
    ) -> float:
        compounding_periods_per_year = {
            "daily": 365.0,
            "monthly": 12.0,
            "quarterly": 4.0,
            "annually": 1.0,
        }
        payments_per_year = {
            "weekly": 52.0,
            "bi-weekly": 26.0,
            "monthly": 12.0,
            "quarterly": 4.0,
            "annually": 1.0,
        }
        annual_rate_decimal = annual_rate / 100.0
        compounding_n = compounding_periods_per_year.get(compounding_period, 12.0)
        payment_n = payments_per_year.get(payment_frequency, 12.0)

        if compounding_n == 0:
            return 0.0
        ear = (1 + annual_rate_decimal / compounding_n) ** compounding_n - 1
        if payment_n == 0:
            return 0.0
        period_rate = (1 + ear) ** (1 / payment_n) - 1
        return round(period_rate, 8)

    def _get_next_payment_date(
        self, current_date: date, payment_frequency: str
    ) -> date:
        if payment_frequency == "weekly":
            return current_date + timedelta(days=7)
        if payment_frequency == "bi-weekly":
            return current_date + timedelta(days=14)
        if payment_frequency == "monthly":
            return self._add_months(current_date, 1)
        if payment_frequency == "quarterly":
            return self._add_months(current_date, 3)
        if payment_frequency == "annually":
            return self._add_months(current_date, 12)
        return self._add_months(current_date, 1)

    def _add_months(self, source_date: date, months: int) -> date:
        month = source_date.month - 1 + months
        year = source_date.year + month // 12
        month = month % 12 + 1
        day = min(source_date.day, self._get_days_in_month(year, month))
        try:
            return date(year, month, day)
        except ValueError:
            self.logger.error(
                f"Error calculating date with year={year}, month={month}, day={day}"
            )
            return source_date + timedelta(days=months * 30)  # Fallback

    def _get_days_in_month(self, year: int, month: int) -> int:
        if month == 2:
            is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
            return 29 if is_leap else 28
        if month in [4, 6, 9, 11]:
            return 30
        return 31

    def _calculate_number_of_payments(
        self, start_date: date, end_date: date | None, payment_frequency: str
    ) -> int:
        if not end_date or start_date >= end_date:
            return 0
        count = 0
        current_check_date = start_date
        safety_max_count = 1200
        while current_check_date <= end_date and count < safety_max_count:
            count += 1
            if current_check_date == end_date and count > 0:
                break
            current_check_date = self._get_next_payment_date(
                current_check_date, payment_frequency
            )
            if current_check_date > end_date and count > 0:
                break
        return count if count < safety_max_count else 0

    def get_liability_payments_from_api(self) -> list[dict[str, Any]]:
        """Fetch all liability payments from the API."""
        url = f"{self.base_url}/liability_payments?per_page=1000"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()["items"]
        logger.error(f"Failed to retrieve liability payments: {response.status_code}, {response.text}")
        return []

    def generate_interest_expense_transactions(self, liability_id: int, user_id: int) -> bool:
        """Generate interest expense transactions for capitalized interest during deferral periods.

        Args:
            liability_id (int): The ID of the liability to generate transactions for
            user_id (int): The user ID

        Returns:
            bool: True if successful, False otherwise
        """
        from app.services.transaction_service import TransactionService
        from app.services.base_service import ListQueryParams

        pl_account_expense_id = None
        try:
            pl_account_query = """--sql
            SELECT id FROM accounts
            WHERE user_id = ? AND name = 'Investment P/L' AND type = 'expense'
            """
            pl_account_expense_result = self.db_manager.execute_select(
                pl_account_query, [user_id]
            )
            pl_account_expense_id = pl_account_expense_result[0]["id"]

        except NoResultFoundError:
            bank_query = "SELECT id FROM banks WHERE user_id = ? LIMIT 1"
            bank_result = self.db_manager.execute_select(
                bank_query, [user_id]
            )

            if not bank_result:
                raise ValueError(
                    "No bank found for user. Please create a bank first."
                )

            bank_id = bank_result[0]["id"]

            # Now create the Investment P/L account
            create_pl_expense_account_query = """--sql
            INSERT INTO accounts (user_id, name, type, bank_id)
            VALUES (?, 'Investment P/L', 'expense', ?)
            RETURNING id
            """
            pl_account_expense_result = self.db_manager.execute_insert_returning(
                create_pl_expense_account_query,
                [user_id, bank_id],
            )
            pl_account_expense_id = pl_account_expense_result["id"]



        # Get the liability data
        liability_obj = self.get_by_id(liability_id, user_id)
        if not liability_obj:
            self.logger.error(f"Liability {liability_id} not found for user {user_id}")
            return False

        # Get the amortization schedule to find the capitalized interest amounts
        amortization_schedule = self.generate_amortization_schedule(liability_id, user_id)

        # Filter for entries with capitalized interest
        capitalization_entries = [
            entry for entry in amortization_schedule
            if entry.get('is_deferred') and entry.get('deferral_type') == 'total'
            and entry.get('capitalized_interest', 0) > 0
        ]
        print(amortization_schedule)
        print(capitalization_entries)

        # if not capitalization_entries:
        #     self.logger.info(f"No interest capitalization entries found for liability {liability_id}")
        #     return True

        # Get the associated account
        account_id = liability_obj["account_id"]
        print(f"{account_id=}")
        if not account_id:
            self.logger.error(f"Liability {liability_id} has no associated account")
            return False

        # Create a transaction for each capitalization entry
        transaction_service = TransactionService()
        count = 0

        try:
            for entry in amortization_schedule:
                # Check if we already have a transaction for this date (avoid duplicates)
                if round(entry["capitalized_interest"], 2) == 0.00:
                    continue
                query_params = ListQueryParams(
                    page=1,
                    per_page=10,
                    filters={
                        "date": entry["payment_date"],
                        "to_account_id": account_id,
                        "description": f"Interest capitalization for {liability_obj['name']}"
                    },
                    sort_by=None,
                    sort_order=None,
                    fields=None
                )
                existing_txns = transaction_service.get_all(user_id=user_id, query_params=query_params)

                if existing_txns.get("items") and len(existing_txns["items"]) > 0:
                    self.logger.info(f"Interest transaction already exists for {entry['payment_date']}, skipping")
                    continue

                # Create expense transaction for capitalized interest
                transaction_data = {
                    "date": entry["payment_date"],
                    "date_accountability": entry["payment_date"],
                    "amount": entry["capitalized_interest"],
                    "description": f"Interest capitalization for {liability_obj['name']}",
                    "type": "expense",
                    "category": "Interest Expense",
                    "subcategory": f"Loan Interest - {liability_obj['liability_type']}",
                    "to_account_id": pl_account_expense_id,  # The loan account receives the expense
                    "from_account_id": account_id,  # The loan account is also the source (internal transaction)
                    "user_id": user_id
                }
                print(f"{transaction_data=}")
                transaction_result = transaction_service.create(transaction_data)
                if transaction_result:
                    count += 1
                    self.logger.info(
                        f"Created interest expense transaction for {entry['payment_date']}: "
                        f"{entry['capitalized_interest']} on liability {liability_id}"
                    )
                else:
                    self.logger.error(
                        f"Failed to create interest expense transaction for {entry['payment_date']}"
                    )

            self.logger.info(f"Generated {count} interest expense transactions for liability {liability_id}")
            return True

        except Exception as e:
            self.logger.exception(f"Error generating interest expense transactions: {e}")
            return False


class LiabilityPaymentDetailService(BaseService[LiabilityPaymentDetail]):
    """Service for managing liability payment details."""

    def __init__(self) -> None:
        super().__init__("liability_payment_details", LiabilityPaymentDetail)
        self.logger = get_logger(__name__)

    def get_all_for_liability(
        self, liability_id: int, user_id: int
    ) -> list[dict[str, Any]]:
        query = """--sql
            SELECT * FROM liability_payment_details
            WHERE liability_id = ? AND user_id = ?
            ORDER BY payment_date ASC, transaction_id ASC
        """
        try:
            return self.db_manager.execute_select(query, [liability_id, user_id])
        except NoResultFoundError:
            return []

    def record_payment(
        self,
        liability_id: int,
        user_id: int,
        payment_date: date,
        amount: float,
        principal_amount: float,
        interest_amount: float,
        transaction_id: int | None,
        extra_payment: float = 0.0,
    ) -> dict[str, Any]:
        if transaction_id is None:
            raise ValueError(
                "transaction_id is required to record a liability payment detail."
            )

        data_to_create: dict[str, Any] = {
            "transaction_id": transaction_id,
            "liability_id": liability_id,
            "user_id": user_id,
            "payment_date": payment_date.isoformat(),  # No need for isinstance if type hint is date
            "amount": amount,
            "principal_amount": principal_amount,
            "interest_amount": interest_amount,
            "extra_payment": extra_payment,
        }
        payment_obj = self.create(data_to_create)
        if not payment_obj:
            return {}

        payment_dict: dict[str, Any] = dataclasses.asdict(payment_obj)
        for key in ["payment_date", "created_at", "updated_at"]:
            if isinstance(payment_dict.get(key), (date, datetime)):
                payment_dict[key] = payment_dict[key].isoformat()

        if transaction_id:
            transaction_query = """--sql
                SELECT t.*, from_acc.name as from_account_name, to_acc.name as to_account_name
                FROM transactions t
                LEFT JOIN accounts from_acc ON t.from_account_id = from_acc.id
                LEFT JOIN accounts to_acc ON t.to_account_id = to_acc.id
                WHERE t.id = ? AND t.user_id = ? """
            try:
                transaction_result = self.db_manager.execute_select(
                    transaction_query, [transaction_id, user_id]
                )
                if transaction_result:
                    payment_dict["transaction"] = transaction_result[0]
            except (NoResultFoundError, QueryExecutionError):
                self.logger.info(
                    f"Transaction details not found for id: {transaction_id}"
                )

        liability_dict_for_resp = self.get_by_id(
            liability_id, user_id
        )  # Already returns dict
        if liability_dict_for_resp:
            payment_dict["liability"] = (
                liability_dict_for_resp  # This is already a dict with ISO dates
            )

        return payment_dict
