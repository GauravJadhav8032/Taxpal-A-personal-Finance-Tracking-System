import axios from 'axios';
import { Observable, from } from 'rxjs';

export interface Expense {
  _id: string;
  userId: string;
  description: string;
  amount: number;
  category: string;
  date: string;     // ISO
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateExpenseBody = {
  description: string;
  amount: number;
  category: string;
  date: string | Date; // server expects a valid ISO date; Date is ok (we’ll convert)
  notes?: string;
};

export type UpdateExpenseBody = Partial<CreateExpenseBody>;

export class ExpenseService {
  // If you have a dev proxy mapping "/api" → backend:
  private base = '/api/v1/expenses';
  // Otherwise: private base = 'http://localhost:3000/api/v1/expenses';

  constructor() {}

  create(body: CreateExpenseBody): Observable<Expense> {
    const payload: any = { ...body };
    if (payload.date instanceof Date) payload.date = payload.date.toISOString();
    return from(axios.post<Expense>(this.base, payload).then(res => res.data));
  }

  list(params?: {
    from?: string | Date;
    to?: string | Date;
    category?: string;
  }): Observable<Expense[]> {
    const p: any = {};
    if (params) {
      const { from, to, category } = params;
      if (category) p.category = category;
      if (from) p.from = from instanceof Date ? from.toISOString() : String(from);
      if (to)   p.to   = to   instanceof Date ? to.toISOString()   : String(to);
    }
    return from(axios.get<Expense[]>(this.base, { params: p }).then(res => res.data));
  }

  update(id: string, patch: UpdateExpenseBody): Observable<Expense> {
    const payload: any = { ...patch };
    if (payload.date instanceof Date) payload.date = payload.date.toISOString();
    return from(axios.put<Expense>(`${this.base}/${id}`, payload).then(res => res.data));
  }

  remove(id: string): Observable<{ deleted: true; _id: string }> {
    return from(axios.delete<{ deleted: true; _id: string }>(`${this.base}/${id}`).then(res => res.data));
  }
}
