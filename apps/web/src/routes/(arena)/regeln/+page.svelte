<script lang="ts">
  import { t } from '$lib/i18n';
</script>

<h1>{t().rulesTitle}</h1>
<p class="sub">{t().rulesIntro}</p>
<a class="btn" href="/versuch">{t().understood}</a>

<style>
  h1 {
    font-size: 26px;
    margin: 0 0 6px;
    color: #fff;
  }
  .sub {
    color: var(--dim);
    margin: 0 0 20px;
    max-width: 640px;
  }
  .btn {
    display: inline-block;
    background: var(--green);
    color: #04130a;
    border: 0;
    padding: 11px 20px;
    font: inherit;
    font-weight: 700;
    border-radius: 6px;
    text-decoration: none;
  }
</style>
