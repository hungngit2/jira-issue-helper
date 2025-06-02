import fetch from 'node-fetch'

export type ResponseType = "json" | "text" | "buffer" | "stream";
export type RequestParams = {
  body?: object,
  responseType?: ResponseType
  isFormData?: boolean,
  headers?: object
}

export class Fetch {
  public static authorization: string
  public static apiServer: string

  public async post(urlPath: string, params?: RequestParams) {
    return this.request('POST', urlPath, params)
  }

  public async get(urlPath: string, params?: RequestParams) {
    return this.request('GET', urlPath, params)
  }

  public async delete(urlPath: string, params?: RequestParams) {
    return this.request('DELETE', urlPath, params)
  }

  public async put(urlPath: string, params?: RequestParams) {
    return this.request('PUT', urlPath, params)
  }

  private async request(method: string, urlPath: string, params?: RequestParams): Promise<any> {
    const options = this.getRequestOptions(method, params)
    const responseType = params?.responseType ?? 'json'

    console.log(`***${method}: ${Fetch.apiServer}${urlPath}`)

    try {
      const res = await fetch(Fetch.apiServer + urlPath, options)
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`Request failed! Status: ${res.status}`, errorText)
        throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`)
      }
      if (res.status === 204) {
        console.log('No content returned.')
        return null
      }
      switch (responseType) {
        case 'json':
          return res.json()
        case 'text':
          return res.text()
        case 'buffer':
          return res.arrayBuffer()
        case 'stream':
          return res.body
        default:
          return res.json()
      }
    } catch (error) {
      return { message: 'Can’t parse response.', error }
    }
  }

  private getRequestOptions(method: string, params?: RequestParams) {
    const { body = {}, headers = {}, isFormData = false } = params || {}
    const options: { [key: string]: any } = {
      method,
      headers: {
        ...headers,
        Authorization: Fetch.authorization
      }
    }

    if (method === 'POST' || method === 'PUT') {
      if (isFormData) {
        options.body = body
      } else {
        options.headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
      }
    }
    return options
  }
}

export default new Fetch()