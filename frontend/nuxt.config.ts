// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  
  ssr: false,

  modules: [
    '@element-plus/nuxt',
    '@pinia/nuxt'
  ],

  css: [
    '@/assets/styles/element-theme.scss',
    '@/assets/styles/main.scss'
  ],

  app: {
    head: {
      title: '智能电网故障诊断系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: '智能电网故障诊断系统'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }
      ]
    },
    buildAssetsDir: '/_nuxt/'
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1',
    }
  },

  vite: {
    resolve: {
      preserveSymlinks: true
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "@/assets/styles/variables.scss" as *;'
        }
      }
    },
    optimizeDeps: {
      include: ['echarts']
    }
  },

  elementPlus: {
    /** Options */
    themes: ['dark']
  },

  typescript: {
    strict: false,
    typeCheck: false
  },

  experimental: {
    payloadExtraction: false,
    appManifest: false
  },

  compatibilityDate: '2024-01-01'
})
