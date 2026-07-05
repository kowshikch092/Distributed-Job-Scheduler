class ApiClient {
	formatErrorDetail(detail) {
		if (Array.isArray(detail)) {
			return detail
				.map(item => this.formatErrorDetail(item))
				.filter(Boolean)
				.join(', ');
		}

		if (detail && typeof detail === 'object') {
			if (detail.msg && detail.loc) {
				const location = Array.isArray(detail.loc) ? detail.loc.join('.') : String(detail.loc);
				return `${location}: ${detail.msg}`;
			}

			if ('detail' in detail) {
				return this.formatErrorDetail(detail.detail);
			}

			return JSON.stringify(detail);
		}

		return detail ? String(detail) : '';
	}

	constructor(baseUrl = '') {
		this.baseUrl = baseUrl;
	}

	getToken() {
		return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
	}

	buildHeaders(body) {
		const headers = {
			Accept: 'application/json',
		};

		const token = this.getToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const isFormPayload = body instanceof FormData || body instanceof URLSearchParams;
		if (body !== undefined && body !== null && !isFormPayload && typeof body === 'object') {
			headers['Content-Type'] = 'application/json';
		}

		return headers;
	}

	async request(method, url, body = null) {
		const response = await fetch(`${this.baseUrl}${url}`, {
			method,
			headers: this.buildHeaders(body),
			body:
				body === null || body === undefined
					? undefined
					: body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string'
						? body
						: JSON.stringify(body),
			credentials: 'same-origin',
		});

		const contentType = response.headers.get('content-type') || '';
		let data = null;

		if (contentType.includes('application/json')) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (!response.ok) {
			const readableDetail = this.formatErrorDetail(data && (data.detail || data.message || data));
			const error = new Error(readableDetail || response.statusText || 'Request failed');
			error.status = response.status;
			error.data = data;
			throw error;
		}

		return data;
	}

	get(url) {
		return this.request('GET', url);
	}

	post(url, body = null) {
		return this.request('POST', url, body);
	}

	put(url, body = null) {
		return this.request('PUT', url, body);
	}

	delete(url) {
		return this.request('DELETE', url);
	}
}

window.api = window.api || new ApiClient();
