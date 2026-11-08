# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'

module IslandForge
  class Error < StandardError
    attr_reader :status

    def initialize(message, status = nil)
      super(message)
      @status = status
    end
  end

  # HTTP client for an Island Forge server (`npm start`, default http://localhost:5173).
  class Client
    def initialize(base_url = 'http://localhost:5173', timeout: 600)
      @base = base_url.chomp('/')
      @timeout = timeout
    end

    def providers = get('/api/providers')
    def catalog = get('/api/catalog')

    def generate(prompt, mode: 'reload', provider: 'anthropic', model: nil, api_key: nil, base_url: nil)
      body = { prompt: prompt, mode: mode, provider: provider }
      body[:model] = model if model
      body[:apiKey] = api_key if api_key
      body[:baseUrl] = base_url if base_url
      Spec.new(JSON.parse(post('/api/generate', body))['spec'])
    end

    def verse(spec) = JSON.parse(post('/api/verse', { spec: spec_data(spec) }))['files']
    def readme(spec) = post('/api/readme', { spec: spec_data(spec) })
    def package(spec) = post('/api/package', { spec: spec_data(spec) })

    private

    def spec_data(spec) = spec.is_a?(Spec) ? spec.data : spec

    def get(path) = JSON.parse(request(Net::HTTP::Get.new(uri(path))))

    def post(path, body)
      req = Net::HTTP::Post.new(uri(path), 'content-type' => 'application/json')
      req.body = JSON.generate(body)
      request(req)
    end

    def uri(path) = URI("#{@base}#{path}")

    def request(req)
      u = req.uri
      res = Net::HTTP.start(u.host, u.port, use_ssl: u.scheme == 'https', open_timeout: 5, read_timeout: @timeout) { |http| http.request(req) }
      return res.body.b if res.is_a?(Net::HTTPSuccess) && res['content-type'].to_s.include?('zip')
      return res.body.to_s.dup.force_encoding('UTF-8') if res.is_a?(Net::HTTPSuccess)

      message = begin
        JSON.parse(res.body)['error']
      rescue JSON::ParserError, TypeError
        res.body
      end
      raise Error.new(message, res.code.to_i)
    rescue SystemCallError, SocketError, Net::OpenTimeout => e
      raise Error, "Could not reach the Island Forge server at #{@base} (#{e.message}). Start it with `npm start`."
    end
  end
end
